import { useEffect, useRef, useState } from "react";

const storageKeys = {
  apiBase: "content-broadcast.api-base",
  token: "content-broadcast.token",
  user: "content-broadcast.user",
};

const defaultTeacherFilters = { status: "", subject: "" };
const defaultPrincipalFilters = { status: "", subject: "", teacher_id: "" };
const defaultLiveQuery = { teacherId: "", subject: "" };

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function localInputToIso(value) {
  return value ? new Date(value).toISOString() : "";
}

function classForStatus(status) {
  return `badge badge--${status}`;
}

function App() {
  const [apiBase, setApiBase] = useState(
    localStorage.getItem(storageKeys.apiBase) || "http://localhost:3000"
  );
  const [draftApiBase, setDraftApiBase] = useState(apiBase);
  const [token, setToken] = useState(localStorage.getItem(storageKeys.token) || "");
  const [user, setUser] = useState(safeParse(localStorage.getItem(storageKeys.user)));
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "teacher",
  });
  const [connectionMessage, setConnectionMessage] = useState(`Using ${apiBase}`);
  const [authBusy, setAuthBusy] = useState(false);
  const [teacherBusy, setTeacherBusy] = useState(false);
  const [principalBusy, setPrincipalBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [teacherFilters, setTeacherFilters] = useState(defaultTeacherFilters);
  const [principalFilters, setPrincipalFilters] = useState(defaultPrincipalFilters);
  const [teacherContent, setTeacherContent] = useState([]);
  const [principalPending, setPrincipalPending] = useState([]);
  const [principalContent, setPrincipalContent] = useState([]);
  const [liveQuery, setLiveQuery] = useState(defaultLiveQuery);
  const [liveResults, setLiveResults] = useState([]);
  const [liveMessage, setLiveMessage] = useState("");
  const [uploadForm, setUploadForm] = useState({
    title: "",
    subject: "",
    description: "",
    start_time: "",
    end_time: "",
    rotation_duration_minutes: "",
    rotation_order: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKeys.apiBase, apiBase);
  }, [apiBase]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(storageKeys.token, token);
    } else {
      localStorage.removeItem(storageKeys.token);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(storageKeys.user, JSON.stringify(user));
    } else {
      localStorage.removeItem(storageKeys.user);
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    hydrateSession();
  }, []);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    loadTeacherContent();
  }, [user, teacherFilters]);

  useEffect(() => {
    if (!user || user.role !== "principal") return;
    loadPrincipalPending();
    loadPrincipalContent();
  }, [user, principalFilters]);

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `Request failed with status ${response.status}`);
    }
    return payload;
  }

  async function hydrateSession() {
    try {
      const payload = await request("/api/auth/me", { method: "GET" });
      setUser(payload.data.user);
    } catch (error) {
      handleLogout(false);
      setConnectionMessage(`Saved session expired: ${error.message}`);
    }
  }

  function handleConfigSubmit(event) {
    event.preventDefault();
    const nextBase = draftApiBase.trim().replace(/\/$/, "");
    setApiBase(nextBase);
    setConnectionMessage(`Using ${nextBase}`);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const isRegister = authMode === "register";
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const payload = {
      email: authForm.email.trim(),
      password: authForm.password,
    };

    if (isRegister) {
      payload.name = authForm.name.trim();
      payload.role = authForm.role;
    }

    setAuthBusy(true);
    try {
      const response = await request(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(response.data.user);
      setToken(response.data.token);
      setAuthForm({ name: "", email: "", password: "", role: "teacher" });
      window.alert(response.message || "Authenticated successfully.");
    } catch (error) {
      window.alert(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout(showNotice = true) {
    setUser(null);
    setToken("");
    setTeacherContent([]);
    setPrincipalPending([]);
    setPrincipalContent([]);
    if (showNotice) {
      window.alert("Logged out.");
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      window.alert("Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("title", uploadForm.title.trim());
    formData.append("subject", uploadForm.subject.trim());
    if (uploadForm.description.trim()) {
      formData.append("description", uploadForm.description.trim());
    }
    if (uploadForm.start_time) {
      formData.append("start_time", localInputToIso(uploadForm.start_time));
    }
    if (uploadForm.end_time) {
      formData.append("end_time", localInputToIso(uploadForm.end_time));
    }
    if (uploadForm.rotation_duration_minutes) {
      formData.append(
        "rotation_duration_minutes",
        Number(uploadForm.rotation_duration_minutes)
      );
    }
    if (uploadForm.rotation_order) {
      formData.append("rotation_order", uploadForm.rotation_order);
    }
    formData.append("file", file);

    setTeacherBusy(true);
    try {
      const response = await request("/api/content/upload", {
        method: "POST",
        body: formData,
      });
      setUploadForm({
        title: "",
        subject: "",
        description: "",
        start_time: "",
        end_time: "",
        rotation_duration_minutes: "",
        rotation_order: "",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadTeacherContent();
      window.alert(response.message || "Content uploaded.");
    } catch (error) {
      window.alert(error.message);
    } finally {
      setTeacherBusy(false);
    }
  }

  async function loadTeacherContent() {
    setTeacherBusy(true);
    try {
      const query = new URLSearchParams();
      if (teacherFilters.status) query.set("status", teacherFilters.status);
      if (teacherFilters.subject) query.set("subject", teacherFilters.subject);
      const suffix = query.toString() ? `?${query}` : "";
      const payload = await request(`/api/content${suffix}`, { method: "GET" });
      setTeacherContent(payload.data || []);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setTeacherBusy(false);
    }
  }

  async function loadPrincipalPending() {
    setPrincipalBusy(true);
    try {
      const payload = await request("/api/content/pending", { method: "GET" });
      setPrincipalPending(payload.data || []);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setPrincipalBusy(false);
    }
  }

  async function loadPrincipalContent() {
    setPrincipalBusy(true);
    try {
      const query = new URLSearchParams();
      Object.entries(principalFilters).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      const suffix = query.toString() ? `?${query}` : "";
      const payload = await request(`/api/content${suffix}`, { method: "GET" });
      setPrincipalContent(payload.data || []);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setPrincipalBusy(false);
    }
  }

  async function handleScheduleSave(contentId, formState) {
    try {
      const payload = {
        start_time: localInputToIso(formState.start_time),
        end_time: localInputToIso(formState.end_time),
      };
      if (formState.rotation_duration_minutes) {
        payload.rotation_duration_minutes = formState.rotation_duration_minutes;
      }
      if (formState.rotation_order) {
        payload.rotation_order = formState.rotation_order;
      }
      const response = await request(`/api/content/${contentId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadTeacherContent();
      window.alert(response.message || "Schedule updated.");
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function handleApprove(contentId) {
    try {
      const response = await request(`/api/content/${contentId}/approve`, {
        method: "PATCH",
      });
      await Promise.all([loadPrincipalPending(), loadPrincipalContent()]);
      window.alert(response.message || "Approved.");
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function handleReject(contentId, rejectionReason) {
    try {
      const response = await request(`/api/content/${contentId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      await Promise.all([loadPrincipalPending(), loadPrincipalContent()]);
      window.alert(response.message || "Rejected.");
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function handleLiveLookup(event) {
    event.preventDefault();
    setLiveBusy(true);
    setLiveMessage("Checking active rotation...");
    try {
      const query = new URLSearchParams();
      if (liveQuery.subject.trim()) query.set("subject", liveQuery.subject.trim());
      const suffix = query.toString() ? `?${query}` : "";
      const payload = await request(`/api/content/live/${liveQuery.teacherId}${suffix}`, {
        method: "GET",
      });
      setLiveResults(payload.data || []);
      setLiveMessage(payload.message || "");
    } catch (error) {
      setLiveResults([]);
      setLiveMessage(error.message);
    } finally {
      setLiveBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Content Broadcasting System</p>
          <h1>Frontend console for teachers, principals, and live classroom display.</h1>
          <p className="hero__text">
            This React UI is wired around the completed backend APIs: auth, upload,
            scheduling, approval, and public live rotation lookup.
          </p>
        </div>

        <aside className="config-card panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">API Target</p>
              <h2>Connection</h2>
            </div>
          </div>

          <form className="stack" onSubmit={handleConfigSubmit}>
            <label className="field">
              <span>Backend base URL</span>
              <input
                type="url"
                value={draftApiBase}
                onChange={(event) => setDraftApiBase(event.target.value)}
                placeholder="http://localhost:3000"
                required
              />
            </label>
            <button type="submit" className="button button--secondary">
              Save API base
            </button>
          </form>

          <div className="notice notice--soft">{connectionMessage}</div>
        </aside>
      </header>

      <main className="layout">
        <section className="panel auth-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Secure Access</p>
              <h2>Authentication</h2>
            </div>
            <div className="tab-switch">
              <button
                className={`tab-switch__button ${authMode === "login" ? "is-active" : ""}`}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={`tab-switch__button ${authMode === "register" ? "is-active" : ""}`}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
            </div>
          </div>

          <form className="stack" onSubmit={handleAuthSubmit}>
            <div className="auth-grid">
              {authMode === "register" ? (
                <label className="field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Teacher One"
                    required
                  />
                </label>
              ) : null}
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="teacher@example.com"
                  required
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Password123"
                  required
                />
              </label>
              {authMode === "register" ? (
                <label className="field">
                  <span>Role</span>
                  <select
                    value={authForm.role}
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, role: event.target.value }))
                    }
                  >
                    <option value="teacher">Teacher</option>
                    <option value="principal">Principal</option>
                  </select>
                </label>
              ) : null}
            </div>
            <button type="submit" className="button" disabled={authBusy}>
              {authMode === "register" ? "Create account" : "Login"}
            </button>
          </form>

          <div className="demo-credentials">
            <p><strong>Demo principal:</strong> principal@example.com / Password123</p>
            <p><strong>Demo teacher:</strong> teacher@example.com / Password123</p>
          </div>
        </section>

        <section className="panel status-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Session</p>
              <h2>Current user</h2>
            </div>
            {user ? (
              <button className="button button--ghost" type="button" onClick={() => handleLogout()}>
                Logout
              </button>
            ) : null}
          </div>

          {user ? (
            <div className="session-summary">
              <strong>{user.name}</strong>
              <br />
              <span className="meta">{user.email}</span>
              <br />
              <span className={`badge ${user.role === "principal" ? "badge--approved" : "badge--subject"}`}>
                {user.role}
              </span>
            </div>
          ) : (
            <div className="session-summary empty-state">
              Sign in to unlock teacher or principal workflows.
            </div>
          )}
        </section>

        <section className="panel workspace-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Workspace</p>
              <h2>Role dashboard</h2>
            </div>
          </div>

          {!user ? (
            <div className="dashboard-content empty-state">
              Your role-specific tools will appear here after login.
            </div>
          ) : user.role === "teacher" ? (
            <TeacherDashboard
              busy={teacherBusy}
              uploadForm={uploadForm}
              setUploadForm={setUploadForm}
              fileInputRef={fileInputRef}
              onUploadSubmit={handleUploadSubmit}
              teacherFilters={teacherFilters}
              setTeacherFilters={setTeacherFilters}
              teacherContent={teacherContent}
              onScheduleSave={handleScheduleSave}
            />
          ) : (
            <PrincipalDashboard
              busy={principalBusy}
              principalFilters={principalFilters}
              setPrincipalFilters={setPrincipalFilters}
              pendingItems={principalPending}
              contentItems={principalContent}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </section>

        <section className="panel public-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Public View</p>
              <h2>Live content lookup</h2>
            </div>
          </div>

          <form className="stack" onSubmit={handleLiveLookup}>
            <div className="inline-grid">
              <label className="field">
                <span>Teacher ID</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={liveQuery.teacherId}
                  onChange={(event) =>
                    setLiveQuery((current) => ({ ...current, teacherId: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Subject (optional)</span>
                <input
                  type="text"
                  placeholder="maths"
                  value={liveQuery.subject}
                  onChange={(event) =>
                    setLiveQuery((current) => ({ ...current, subject: event.target.value }))
                  }
                />
              </label>
            </div>
            <button type="submit" className="button button--secondary" disabled={liveBusy}>
              Fetch live content
            </button>
          </form>

          <div className="cards cards--public">
            {liveBusy ? <div className="empty-state">Checking active rotation...</div> : null}
            {!liveBusy && liveResults.length === 0 ? (
              <div className="empty-state">{liveMessage || "No live content loaded yet."}</div>
            ) : null}
            {!liveBusy
              ? liveResults.map((item) => <LiveCard key={`${item.subject}-${item.content.id}`} item={item} />)
              : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function TeacherDashboard({
  busy,
  uploadForm,
  setUploadForm,
  fileInputRef,
  onUploadSubmit,
  teacherFilters,
  setTeacherFilters,
  teacherContent,
  onScheduleSave,
}) {
  return (
    <div className="dashboard-grid">
      <section className="subpanel">
        <div className="subpanel__header">
          <div>
            <h3>Upload content</h3>
            <p>Send content for approval and optionally prefill its schedule.</p>
          </div>
        </div>
        <form className="stack" onSubmit={onUploadSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              maxLength="255"
              required
              value={uploadForm.title}
              onChange={(event) =>
                setUploadForm((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <div className="inline-grid">
            <label className="field">
              <span>Subject</span>
              <input
                type="text"
                maxLength="100"
                placeholder="maths"
                required
                value={uploadForm.subject}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>File</span>
              <input ref={fileInputRef} type="file" accept="image/*" required />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea
              rows="3"
              placeholder="Worksheet or slide summary"
              value={uploadForm.description}
              onChange={(event) =>
                setUploadForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <div className="inline-grid inline-grid--triple">
            <label className="field">
              <span>Start time</span>
              <input
                type="datetime-local"
                value={uploadForm.start_time}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, start_time: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>End time</span>
              <input
                type="datetime-local"
                value={uploadForm.end_time}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, end_time: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Rotation duration (minutes)</span>
              <input
                type="number"
                min="1"
                placeholder="5"
                value={uploadForm.rotation_duration_minutes}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    rotation_duration_minutes: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Rotation order (optional)</span>
            <input
              type="number"
              min="1"
              placeholder="Auto if blank"
              value={uploadForm.rotation_order}
              onChange={(event) =>
                setUploadForm((current) => ({ ...current, rotation_order: event.target.value }))
              }
            />
          </label>
          <button type="submit" className="button" disabled={busy}>
            Upload content
          </button>
        </form>
      </section>

      <section className="subpanel">
        <div className="subpanel__header">
          <div>
            <h3>My content</h3>
            <p>Review status and update schedules for your uploaded items.</p>
          </div>
        </div>
        <div className="toolbar">
          <label className="field">
            <span>Status</span>
            <select
              value={teacherFilters.status}
              onChange={(event) =>
                setTeacherFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              placeholder="maths"
              value={teacherFilters.subject}
              onChange={(event) =>
                setTeacherFilters((current) => ({ ...current, subject: event.target.value }))
              }
            />
          </label>
          <div className="toolbar__status">
            {busy ? <span className="meta">Refreshing...</span> : <span className="meta">Live API-backed list</span>}
          </div>
        </div>
        <div className="cards">
          {teacherContent.length === 0 ? (
            <div className="empty-state">No teacher content matched the current filters.</div>
          ) : (
            teacherContent.map((item) => (
              <TeacherContentCard key={item.id} item={item} onScheduleSave={onScheduleSave} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TeacherContentCard({ item, onScheduleSave }) {
  const [formState, setFormState] = useState({
    start_time: toDateTimeLocalValue(item.start_time),
    end_time: toDateTimeLocalValue(item.end_time),
    rotation_duration_minutes: item.duration_minutes ?? "",
    rotation_order: item.rotation_order ?? "",
  });

  return (
    <article className="content-card">
      <div className="content-card__header">
        <div>
          <h3>{item.title}</h3>
          <p className="meta">Content #{item.id}</p>
        </div>
        <div className="badge-row">
          <span className={classForStatus(item.status)}>{item.status}</span>
          <span className="badge badge--subject">{item.subject}</span>
        </div>
      </div>
      <p className="content-card__description">{item.description || "No description provided."}</p>
      {item.file_url ? <img src={item.file_url} alt={item.title} /> : null}
      <p className="content-card__meta">
        Uploaded by teacher ID {item.uploaded_by}. Start: {formatDate(item.start_time)}. End:{" "}
        {formatDate(item.end_time)}.
      </p>
      <p className="content-card__meta">
        Rotation order: {item.rotation_order ?? "Not set"}. Duration:{" "}
        {item.duration_minutes ?? "Default or not set"} minutes.
      </p>
      {item.rejection_reason ? (
        <p className="content-card__reason">
          <strong>Rejection note:</strong> {item.rejection_reason}
        </p>
      ) : null}
      <form
        className="content-card__schedule"
        onSubmit={(event) => {
          event.preventDefault();
          onScheduleSave(item.id, formState);
        }}
      >
        <input
          type="datetime-local"
          value={formState.start_time}
          onChange={(event) =>
            setFormState((current) => ({ ...current, start_time: event.target.value }))
          }
        />
        <input
          type="datetime-local"
          value={formState.end_time}
          onChange={(event) =>
            setFormState((current) => ({ ...current, end_time: event.target.value }))
          }
        />
        <input
          type="number"
          min="1"
          placeholder="Duration"
          value={formState.rotation_duration_minutes}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              rotation_duration_minutes: event.target.value,
            }))
          }
        />
        <input
          type="number"
          min="1"
          placeholder="Order"
          value={formState.rotation_order}
          onChange={(event) =>
            setFormState((current) => ({ ...current, rotation_order: event.target.value }))
          }
        />
        <button type="submit" className="button button--ghost">
          Save schedule
        </button>
      </form>
    </article>
  );
}

function PrincipalDashboard({
  busy,
  principalFilters,
  setPrincipalFilters,
  pendingItems,
  contentItems,
  onApprove,
  onReject,
}) {
  return (
    <div className="dashboard-grid dashboard-grid--principal">
      <section className="subpanel">
        <div className="subpanel__header">
          <div>
            <h3>Pending approval queue</h3>
            <p>Approve immediately or reject with a clear review note.</p>
          </div>
        </div>
        <div className="cards">
          {busy && pendingItems.length === 0 ? (
            <div className="empty-state">Loading approval queue...</div>
          ) : pendingItems.length === 0 ? (
            <div className="empty-state">Nothing is waiting for approval right now.</div>
          ) : (
            pendingItems.map((item) => (
              <PrincipalReviewCard
                key={item.id}
                item={item}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))
          )}
        </div>
      </section>

      <section className="subpanel">
        <div className="subpanel__header">
          <div>
            <h3>All content</h3>
            <p>Browse uploaded items across teachers and statuses.</p>
          </div>
        </div>
        <div className="toolbar toolbar--principal">
          <label className="field">
            <span>Status</span>
            <select
              value={principalFilters.status}
              onChange={(event) =>
                setPrincipalFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              placeholder="maths"
              value={principalFilters.subject}
              onChange={(event) =>
                setPrincipalFilters((current) => ({ ...current, subject: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Teacher ID</span>
            <input
              type="number"
              min="1"
              placeholder="2"
              value={principalFilters.teacher_id}
              onChange={(event) =>
                setPrincipalFilters((current) => ({ ...current, teacher_id: event.target.value }))
              }
            />
          </label>
          <div className="toolbar__status">
            {busy ? <span className="meta">Refreshing...</span> : <span className="meta">Cross-teacher view</span>}
          </div>
        </div>
        <div className="cards">
          {contentItems.length === 0 ? (
            <div className="empty-state">No content matched the current principal filters.</div>
          ) : (
            contentItems.map((item) => <ReadOnlyContentCard key={item.id} item={item} />)
          )}
        </div>
      </section>
    </div>
  );
}

function PrincipalReviewCard({ item, onApprove, onReject }) {
  const [rejectionReason, setRejectionReason] = useState(item.rejection_reason || "");

  return (
    <article className="content-card">
      <div className="content-card__header">
        <div>
          <h3>{item.title}</h3>
          <p className="meta">Content #{item.id}</p>
        </div>
        <div className="badge-row">
          <span className={classForStatus(item.status)}>{item.status}</span>
          <span className="badge badge--subject">{item.subject}</span>
        </div>
      </div>
      <p className="content-card__description">{item.description || "No description provided."}</p>
      {item.file_url ? <img src={item.file_url} alt={item.title} /> : null}
      <p className="content-card__meta">
        Uploaded by teacher ID {item.uploaded_by}. Start: {formatDate(item.start_time)}. End:{" "}
        {formatDate(item.end_time)}.
      </p>
      <div className="content-card__actions">
        <button className="button button--secondary" type="button" onClick={() => onApprove(item.id)}>
          Approve
        </button>
        <input
          type="text"
          placeholder="Rejection reason"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
        />
        <button
          className="button button--ghost"
          type="button"
          onClick={() => onReject(item.id, rejectionReason.trim())}
        >
          Reject
        </button>
      </div>
    </article>
  );
}

function ReadOnlyContentCard({ item }) {
  return (
    <article className="content-card">
      <div className="content-card__header">
        <div>
          <h3>{item.title}</h3>
          <p className="meta">Content #{item.id}</p>
        </div>
        <div className="badge-row">
          <span className={classForStatus(item.status)}>{item.status}</span>
          <span className="badge badge--subject">{item.subject}</span>
        </div>
      </div>
      <p className="content-card__description">{item.description || "No description provided."}</p>
      {item.file_url ? <img src={item.file_url} alt={item.title} /> : null}
      <p className="content-card__meta">
        Uploaded by teacher ID {item.uploaded_by}. Start: {formatDate(item.start_time)}. End:{" "}
        {formatDate(item.end_time)}.
      </p>
      <p className="content-card__meta">
        Rotation order: {item.rotation_order ?? "Not set"}. Duration:{" "}
        {item.duration_minutes ?? "Default or not set"} minutes.
      </p>
      {item.rejection_reason ? (
        <p className="content-card__reason">
          <strong>Rejection note:</strong> {item.rejection_reason}
        </p>
      ) : null}
    </article>
  );
}

function LiveCard({ item }) {
  const { content } = item;
  return (
    <article className="live-card">
      <div className="live-card__header">
        <div>
          <h3>{item.subject}</h3>
          <p className="meta">Currently active item</p>
        </div>
        <span className="badge badge--approved">Live</span>
      </div>
      <h4>{content.title}</h4>
      <p>{content.description || "No description provided."}</p>
      {content.file_url ? <img src={content.file_url} alt={content.title} /> : null}
      <p className="content-card__meta">
        Rotation order {content.rotation_order} for {content.duration_minutes} minutes. Window:{" "}
        {formatDate(content.start_time)} to {formatDate(content.end_time)}.
      </p>
    </article>
  );
}

export default App;
