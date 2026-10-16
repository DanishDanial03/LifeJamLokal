import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  Users,
  Compass,
  CalendarDays,
  MessageCircle,
  Bell,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Bookmark,
  MapPin,
  Heart,
  MessageSquare,
  Send,
  Music2,
  Mic2,
  Radio,
  Disc3,
  Star,
  Check,
  CheckCheck,
  ShieldCheck,
  X,
  Menu,
  LogOut,
  Settings,
  Image as ImageIcon,
  Play,
  SlidersHorizontal,
  Clock,
  MoreHorizontal,
  History,
  Trash2,
  ExternalLink,
  Download,
  RefreshCw,
  LoaderCircle,
  Headphones,
  AudioLines,
  Globe,
  Mail,
  Lock,
  UserRound,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Volume2,
} from "lucide-react";
import { api, money, date, img } from "./api";
import "./styles.css";
const Context = createContext();
const useApp = () => useContext(Context);
const genres = [
  "All genres",
  "Acoustic",
  "Indie",
  "Jazz",
  "R&B",
  "Soul",
  "Funk",
  "Pop",
  "Rock",
  "Folk",
  "Hip-hop",
  "Traditional",
];
const navItems = [
  ["home", Home, "Home"],
  ["discover", Compass, "Discover"],
  ["network", Users, "My network"],
  ["bookings", CalendarDays, "Bookings"],
  ["messages", MessageCircle, "Messages"],
];
function Avatar({ user, size = 42 }) {
  const [failed, setFailed] = useState(false);
  return user?.avatar && !failed ? (
    <img
      className="avatar"
      src={user.avatar}
      alt=""
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="avatar avatar-fallback"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {user?.name
        ?.split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("") || "♪"}
    </span>
  );
}
function Logo() {
  return (
    <a href="#home" className="logo" aria-label="LifeJamLokal home">
      <span className="logo-mark">
        <AudioLines size={25} />
      </span>
      <span>
        LifeJam<span className="logo-lokal">Lokal</span>
        <span className="logo-dot">✳</span>
      </span>
    </a>
  );
}
function Button({
  children,
  variant = "",
  className = "",
  loading = false,
  ...props
}) {
  return (
    <button
      className={`btn ${variant} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
function Empty({ icon: Icon = Music2, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={32} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={25} />
      <span>Getting things in tune…</span>
    </div>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Modal({ title, subtitle, children, onClose, wide = false }) {
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [demo, setDemo] = useState(false);
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [route, setRoute] = useState(location.hash.slice(1) || "home"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [saved, setSaved] = useState([]),
    [connections, setConnections] = useState([]),
    [notifications, setNotifications] = useState([]),
    [revision, setRevision] = useState(0),
    [mobile, setMobile] = useState(false);
  const refresh = () => setRevision((v) => v + 1);
  const tell = (message, error = false) => setToast({ message, error });
  useEffect(() => {
    Promise.all([api("/me"), api("/config")])
      .then(([d, c]) => {
        setUser(d.user);
        setDemo(c.demo);
      })
      .catch((e) => tell(e.message, true))
      .finally(() => setReady(true));
    const fn = () => {
      setRoute(location.hash.slice(1) || "home");
      setMobile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!user) {
      setSaved([]);
      setConnections([]);
      setNotifications([]);
      return;
    }
    Promise.all([api("/saved"), api("/network"), api("/notifications")])
      .then(([s, c, n]) => {
        setSaved(s.musicians);
        setConnections(c.connections);
        setNotifications(n.notifications);
      })
      .catch((e) => tell(e.message, true));
  }, [user, revision]);
  const requireAuth = (fn) => {
    if (!user) setModal({ type: "auth" });
    else fn();
  };
  async function save(mid) {
    requireAuth(async () => {
      try {
        const r = await api("/saved/" + mid, { method: "POST" });
        tell(
          r.saved
            ? "Added to your saved musicians."
            : "Removed from saved musicians.",
        );
        refresh();
      } catch (e) {
        tell(e.message, true);
      }
    });
  }
  async function connect(mid) {
    requireAuth(async () => {
      try {
        const r = await api("/network/" + mid, { method: "POST" });
        tell(
          r.connected
            ? "You’re connected. Let the good things begin."
            : "Connection removed.",
        );
        refresh();
      } catch (e) {
        tell(e.message, true);
      }
    });
  }
  const value = {
    demo,
    user,
    setUser,
    modal,
    setModal,
    tell,
    requireAuth,
    save,
    saved,
    connect,
    connections,
    refresh,
    revision,
  };
  const page = route.split("/")[0];
  if (!ready) return <Loading />;
  return (
    <Context.Provider value={value}>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault();
              location.hash =
                "discover/" +
                encodeURIComponent(new FormData(e.currentTarget).get("q"));
            }}
          >
            <Search size={17} />
            <input
              name="q"
              placeholder="Search your next connection"
              aria-label="Search musicians"
            />
            <kbd>↵</kbd>
          </form>
          <nav className="desktop-nav">
            {navItems.map(([key, Icon, label]) => (
              <a
                key={key}
                className={page === key ? "active" : ""}
                href={"#" + key}
              >
                <Icon size={21} />
                <span>{label}</span>
                {key === "messages" &&
                  notifications.some(
                    (n) => !n.read_at && n.body.includes("sent you a message"),
                  ) && <i className="nav-dot" />}
              </a>
            ))}
          </nav>
          <div className="header-account">
            <a
              className={`notification-button ${page === "notifications" ? "active" : ""}`}
              href="#notifications"
              aria-label="Notifications"
            >
              <Bell size={21} />
              {notifications.some((n) => !n.read_at) && (
                <i className="nav-dot" />
              )}
            </a>
            <span className="header-divider" />
            {user ? (
              <button
                className="account-button"
                onClick={() => setModal({ type: "account" })}
              >
                <Avatar user={user} size={35} />
                <ChevronDown size={14} />
              </button>
            ) : (
              <Button
                variant="small"
                onClick={() => setModal({ type: "auth" })}
              >
                Sign in <ArrowUpRight size={15} />
              </Button>
            )}
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
          </div>
        </div>
        {mobile && (
          <nav className="mobile-nav">
            {navItems.map(([key, Icon, label]) => (
              <a key={key} href={"#" + key}>
                <Icon size={19} />
                {label}
              </a>
            ))}
            <a href="#saved">
              <Bookmark size={19} />
              Saved musicians
            </a>
          </nav>
        )}
      </header>
      <main
        className={`app-layout ${["messages", "profile", "admin"].includes(page) ? "wide-layout" : ""}`}
      >
        <aside className="left-sidebar">
          <ProfileSidebar />
          <nav className="side-menu">
            <a href="#saved" className={page === "saved" ? "selected" : ""}>
              <Bookmark size={19} />
              Saved musicians<span>{saved.length || ""}</span>
            </a>
            <a href="#history" className={page === "history" ? "selected" : ""}>
              <History size={19} />
              Search history
            </a>
            <a
              href="#bookings"
              className={page === "bookings" ? "selected" : ""}
            >
              <CalendarDays size={19} />
              My bookings
            </a>
            {user?.role === "musician" && (
              <a href={"#profile/" + user.id}>
                <Mic2 size={19} />
                My artist profile
              </a>
            )}
            {user?.role === "admin" && (
              <a href="#admin">
                <ShieldCheck size={19} />
                Admin studio
              </a>
            )}
          </nav>
          <div className="side-promo">
            <span className="tiny-label">MADE FOR YOUR NEXT CHAPTER</span>
            <Disc3 size={43} strokeWidth={1.2} />
            <h3>
              Good music.
              <br />
              Great connections.
            </h3>
            <p>
              Your scene is out there.
              <br />
              Let’s find it together.
            </p>
            <a href="#discover">
              Find your people <ArrowUpRight size={16} />
            </a>
            <span className="promo-star">✳</span>
          </div>
          <div className="sidebar-footer">
            <span>
              Kuala Lumpur, Malaysia <span>🇲🇾</span>
            </span>
            <p>© {new Date().getFullYear()} LifeJamLokal</p>
            <span>Built for the love of music.</span>
            <p>Sample community · fictional profiles</p>
          </div>
        </aside>
        <section className="main-content">
          {page === "home" ? (
            <Feed />
          ) : page === "discover" ? (
            <Discover initial={decodeURIComponent(route.slice(9) || "")} />
          ) : page === "profile" ? (
            <ProfilePage uid={Number(route.split("/")[1])} />
          ) : page === "network" ? (
            <Network />
          ) : page === "saved" ? (
            <Saved />
          ) : page === "bookings" ? (
            <Bookings />
          ) : page === "messages" ? (
            <Messages initial={route.split("/")[1]} />
          ) : page === "history" ? (
            <SearchHistory />
          ) : page === "notifications" ? (
            <Notifications items={notifications} />
          ) : page === "admin" ? (
            <Admin />
          ) : (
            <Empty
              title="This stage is empty"
              action={
                <Button onClick={() => (location.hash = "home")}>
                  Back to the feed
                </Button>
              }
            >
              Let’s get you back to the music.
            </Empty>
          )}
        </section>
        {!["messages", "profile", "admin"].includes(page) && (
          <aside className="right-sidebar">
            <RightSidebar />
          </aside>
        )}
      </main>
      <nav className="bottom-nav">
        {navItems.map(([key, Icon, label]) => (
          <a
            key={key}
            className={page === key ? "active" : ""}
            href={"#" + key}
          >
            <Icon size={21} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      {modal?.type === "auth" && (
        <AuthModal initialMode={modal.mode} onClose={() => setModal(null)} />
      )}
      {modal?.type === "account" && (
        <Modal title="Your corner of the scene" onClose={() => setModal(null)}>
          <div className="account-details">
            <Avatar user={user} size={64} />
            <div>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
              <span className="tag">{user.role}</span>
            </div>
          </div>
          <div className="account-actions">
            <Button
              variant="outline"
              onClick={() => setModal({ type: "edit" })}
            >
              <Settings size={17} />
              Edit profile
            </Button>
            {user.role === "musician" && (
              <Button
                variant="outline"
                onClick={() => {
                  location.hash = "profile/" + user.id;
                  setModal(null);
                }}
              >
                View artist profile
              </Button>
            )}
            {user.role === "admin" && (
              <Button
                variant="outline"
                onClick={() => {
                  location.hash = "admin";
                  setModal(null);
                }}
              >
                Open admin studio
              </Button>
            )}
            <Button
              variant="ghost danger"
              onClick={async () => {
                try {
                  await api("/auth/logout", { method: "POST" });
                  setUser(null);
                  setModal(null);
                  location.hash = "home";
                  tell("You’re signed out. See you at the next gig.");
                } catch (e) {
                  tell(e.message, true);
                }
              }}
            >
              <LogOut size={17} />
              Sign out
            </Button>
          </div>
        </Modal>
      )}
      {modal?.type === "compose" && (
        <ComposeModal onClose={() => setModal(null)} />
      )}
      {modal?.type === "book" && (
        <BookingModal
          musician={modal.musician}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "review" && (
        <ReviewModal booking={modal.booking} onClose={() => setModal(null)} />
      )}
      {modal?.type === "edit" && <EditProfile onClose={() => setModal(null)} />}
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} role="status">
          {toast.error ? <X size={18} /> : <CheckCheck size={19} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
function ProfileSidebar() {
  const { demo, user, setModal, connections, saved } = useApp();
  return (
    <div className="profile-sidebar card">
      <div className="profile-banner">
        <span />
        <span />
        <AudioLines size={80} strokeWidth={0.7} />
        <span className="banner-asterisk">✳</span>
      </div>
      <div className="sidebar-profile-body">
        <button
          className="sidebar-avatar"
          onClick={() =>
            user?.role === "musician"
              ? (location.hash = "profile/" + user.id)
              : setModal({ type: user ? "account" : "auth" })
          }
        >
          <Avatar user={user} size={72} />
          {user && <span className="online-dot" />}
        </button>
        <h2>
          {user?.name || "Hey, music lover."}{" "}
          {user && <ShieldCheck size={16} className="verified" />}
        </h2>
        <p>
          {user?.role === "organizer"
            ? "Event organizer & music enthusiast"
            : user?.role === "musician"
              ? "Musician · Making a little noise"
              : user?.role === "admin"
                ? "Keeping the community in harmony"
                : "Your people. Your sound. Your scene."}
        </p>
        <span className="location">
          <MapPin size={13} />
          {user?.location || "Made in Malaysia"}
        </span>
      </div>
      {user ? (
        <div className="profile-stats">
          <a href="#network">
            <span>Your connections</span>
            <strong>{connections.length}</strong>
          </a>
          <a href="#saved">
            <span>Saved musicians</span>
            <strong>{saved.length}</strong>
          </a>
        </div>
      ) : (
        <div className="profile-stats">
          <Button
            variant="outline full"
            onClick={() => setModal({ type: "auth", mode: "register" })}
          >
            Join the scene <ArrowUpRight size={16} />
          </Button>
          {demo && (
            <button
              className="demo-link"
              onClick={() => setModal({ type: "auth" })}
            >
              Just exploring? Try a demo account
            </button>
          )}
        </div>
      )}
      <button
        className="view-profile"
        onClick={() => setModal({ type: user ? "edit" : "auth" })}
      >
        {user ? "Make your profile shine" : "Let the good things begin"}
        <ArrowUpRight size={15} />
      </button>
    </div>
  );
}
function RightSidebar() {
  const { user, connect, connections, revision } = useApp();
  const [people, setPeople] = useState([]);
  useEffect(() => {
    api("/musicians")
      .then((d) => setPeople(d.musicians.slice(0, 3)))
      .catch(() => {});
  }, [revision]);
  return (
    <>
      <div className="card people-card">
        <div className="section-heading">
          <h3>People to jam with</h3>
          <span>✳</span>
        </div>
        <p>A little different. A lot like you.</p>
        {people.map((p) => (
          <div className="suggested-person" key={p.user_id}>
            <a href={"#profile/" + p.user_id}>
              <Avatar user={p} size={43} />
            </a>
            <div>
              <a className="person-name" href={"#profile/" + p.user_id}>
                {p.name}
                <ShieldCheck size={12} />
              </a>
              <small>{p.headline}</small>
              {user?.id !== p.user_id && (
                <button
                  className="connect-pill"
                  onClick={() => connect(p.user_id)}
                >
                  {connections.some((c) => c.id === p.user_id) ? (
                    <>
                      <Check size={12} />
                      Connected
                    </>
                  ) : (
                    <>
                      <Plus size={12} />
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        <a className="card-footer-link" href="#discover">
          Explore the community <ArrowRight size={16} />
        </a>
      </div>
      <div className="open-mic-card">
        <div className="open-mic-top">
          <span className="eyebrow">THE SPOTLIGHT</span>
          <Radio size={20} />
        </div>
        <div className="poster-art">
          <span className="poster-outline">LIVE</span>
          <Mic2 size={81} strokeWidth={1.2} />
          <span className="poster-spark">✦</span>
        </div>
        <h3>
          Small stages.
          <br />
          <em>Big energy.</em>
        </h3>
        <p>Your next favourite artist could be just around the corner.</p>
        <a href="#discover">
          Discover local talent <ArrowUpRight size={17} />
        </a>
        <span className="poster-bottom">GOOD PEOPLE. GREAT MUSIC.</span>
      </div>
      <div className="scene-note">
        <Headphones size={23} />
        <div>
          <h4>A scene built by you.</h4>
          <p>Every connection, every gig, every encore. It all starts here.</p>
        </div>
      </div>
      <div className="footer-links">
        <a href="#discover">Discover</a>
        <a href="#network">Community</a>
        <button onClick={() => (location.hash = "messages")}>
          Say hello ↗
        </button>
      </div>
    </>
  );
}
function Feed() {
  const { user, setModal, requireAuth, revision, tell } = useApp();
  const [posts, setPosts] = useState([]),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("For you"),
    [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    api("/posts" + (tab === "Following" ? "?following=true" : ""))
      .then((d) => {
        setPosts(d.posts);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, user, revision]);
  useEffect(load, [load]);
  return (
    <>
      <section className="welcome-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" />
            THE LOCAL SCENE, ALL IN ONE PLACE
          </span>
          <h1>
            Find your people.
            <br />
            Make some <span>noise.</span>
            <svg viewBox="0 0 155 12">
              <path d="M3 8 Q75 -2 150 6" />
            </svg>
          </h1>
          <p>
            Connect with musicians. Discover your next gig.
            <br />
            Build something worth listening to.
          </p>
          <a href="#discover" className="hero-cta">
            Explore the scene <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring ring-one" />
          <div className="art-ring ring-two" />
          <div className="vinyl">
            <div className="vinyl-label">
              <AudioLines size={30} />
              <span>LIFEJAM LOKAL</span>
              <i />
            </div>
          </div>
          <span className="hero-sticker">
            TURN UP
            <br />
            YOUR POTENTIAL<span>↗</span>
          </span>
          <span className="hero-flower">✳</span>
          <span className="hero-spark">✦</span>
          <div className="hero-wave">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="hero-bottom">
          <span>INDEPENDENT SPIRITS. SHARED STAGES.</span>
          <span>EST. MALAYSIA ↗</span>
        </div>
      </section>
      <div className="community-strip">
        <div className="avatar-stack">
          {[
            "photo-1500648767791-00dcc994a43e",
            "photo-1524504388940-b1c1722653e1",
            "photo-1506794778202-cad84cf45f1d",
          ].map((s) => (
            <img key={s} src={img(s, 70)} alt="Community member" />
          ))}
        </div>
        <p>
          A space for <strong>local talent</strong> and the people who believe
          in it.
        </p>
        <span>✳</span>
      </div>
      <div className="composer card">
        <div className="composer-top">
          <Avatar user={user} size={43} />
          <button
            onClick={() => requireAuth(() => setModal({ type: "compose" }))}
          >
            What’s happening in your scene?
          </button>
          <button
            className="compose-plus"
            aria-label="Create a post"
            onClick={() => requireAuth(() => setModal({ type: "compose" }))}
          >
            <Plus size={21} />
          </button>
        </div>
        <div className="composer-actions">
          <button
            onClick={() => requireAuth(() => setModal({ type: "compose" }))}
          >
            <ImageIcon size={17} className="green" />
            Share a moment
          </button>
          <button
            onClick={() =>
              requireAuth(() => setModal({ type: "compose", tag: "New music" }))
            }
          >
            <Music2 size={17} className="purple" />
            Drop your music
          </button>
          <button
            onClick={() =>
              requireAuth(() =>
                setModal({ type: "compose", tag: "Looking for talent" }),
              )
            }
          >
            <Mic2 size={17} className="orange" />
            Find your talent
          </button>
        </div>
      </div>
      <div className="feed-toolbar">
        <div className="feed-tabs">
          {["For you", "Following"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() =>
                t === "Following" ? requireAuth(() => setTab(t)) : setTab(t)
              }
            >
              {t}
            </button>
          ))}
        </div>
        <span>
          Your daily dose of local <span>✦</span>
        </span>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Empty
          title="Couldn’t load the feed"
          action={<Button onClick={load}>Try again</Button>}
        >
          {error}
        </Empty>
      ) : posts.length ? (
        posts.map((p) => <Post key={p.id} post={p} reload={load} />)
      ) : (
        <Empty
          title="The mic is yours"
          action={
            <Button onClick={() => setModal({ type: "compose" })}>
              Share your first post
            </Button>
          }
        >
          Follow musicians or share something with the community.
        </Empty>
      )}
      <div className="end-note">
        <AudioLines size={22} />
        <p>You’re in good company. Keep making noise.</p>
      </div>
    </>
  );
}
function Post({ post: p, reload }) {
  const { user, requireAuth, tell } = useApp();
  const [comments, setComments] = useState(null),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false);
  async function toggleComments() {
    try {
      setComments(
        comments ? null : (await api(`/posts/${p.id}/comments`)).comments,
      );
    } catch (e) {
      tell(e.message, true);
    }
  }
  async function like() {
    requireAuth(async () => {
      try {
        await api(`/posts/${p.id}/like`, { method: "POST" });
        reload();
      } catch (e) {
        tell(e.message, true);
      }
    });
  }
  return (
    <article className="post card">
      <div className="post-header">
        <a href={p.role === "musician" ? "#profile/" + p.user_id : "#network"}>
          <Avatar user={p} size={45} />
        </a>
        <div>
          <a
            className="post-author"
            href={p.role === "musician" ? "#profile/" + p.user_id : "#network"}
          >
            {p.name}
            <ShieldCheck size={14} />
          </a>
          <p>
            {p.headline ||
              (p.role === "organizer"
                ? "Event organizer · Creating moments"
                : "LifeJamLokal community")}
          </p>
          <small>
            {date(p.created_at)} · <Globe size={10} />
          </small>
        </div>
        <span
          className={`post-tag ${p.tag === "Looking for talent" ? "talent" : ""}`}
        >
          {p.tag}
        </span>
      </div>
      <div className="post-body">
        {p.body.split("\n").map((line, i) => (
          <React.Fragment key={i}>
            {line}
            <br />
          </React.Fragment>
        ))}
      </div>
      {p.image && (
        <div className="post-image">
          <img
            src={p.image}
            alt="A moment from the local music scene"
            loading="lazy"
          />
          <span className="image-caption">
            <span>LIVE & LOKAL</span>
            <AudioLines size={17} />
          </span>
        </div>
      )}
      <div className="post-counts">
        <span>
          <i>♥</i>
          {p.likes} {p.likes === 1 ? "person feels" : "people feel"} this
        </span>
        <button onClick={toggleComments}>
          {p.comment_count} {p.comment_count === 1 ? "comment" : "comments"}
        </button>
      </div>
      <div className="post-actions">
        <button className={p.liked ? "liked" : ""} onClick={like}>
          <Heart size={18} fill={p.liked ? "currentColor" : "none"} />
          {p.liked ? "Feeling it" : "Feel this"}
        </button>
        <button onClick={toggleComments}>
          <MessageCircle size={18} />
          Comment
        </button>
        <button
          onClick={async () => {
            const url = location.origin + "/#home";
            try {
              await navigator.clipboard.writeText(
                `${p.name} on LifeJamLokal: ${p.body}\n${url}`,
              );
              tell("Post copied. Share it with your people.");
            } catch {
              tell("Sharing is unavailable in this browser.", true);
            }
          }}
        >
          <Send size={17} />
          Share
        </button>
      </div>
      {comments && (
        <div className="comments">
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar user={c} size={29} />
              <div>
                <strong>{c.name}</strong>
                <p>{c.body}</p>
              </div>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              requireAuth(async () => {
                setBusy(true);
                try {
                  await api(`/posts/${p.id}/comments`, {
                    method: "POST",
                    body: { body },
                  });
                  setBody("");
                  setComments((await api(`/posts/${p.id}/comments`)).comments);
                } catch (e) {
                  tell(e.message, true);
                } finally {
                  setBusy(false);
                }
              });
            }}
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add your voice…"
              aria-label="Write a comment"
              maxLength={2000}
            />
            <button disabled={busy} aria-label="Post comment">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
function PageHeading({ eyebrow, title, children, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
function MusicianCard({ p }) {
  const { user, saved, save, connections, connect, setModal, requireAuth } =
    useApp();
  return (
    <article className="musician-card card">
      <a href={"#profile/" + p.user_id} className="musician-cover">
        <img
          src={p.cover || img("photo-1516280440614-37939bbacd81")}
          alt={p.headline}
          loading="lazy"
        />
        {p.score !== undefined && (
          <span className="match-score">
            <AudioLines size={13} />
            {Math.round(Math.max(0, p.score) * 100)}% relevance
          </span>
        )}
      </a>
      <button
        className={`save-button ${saved.some((s) => s.user_id === p.user_id) ? "is-saved" : ""}`}
        onClick={() => save(p.user_id)}
        aria-label={
          saved.some((s) => s.user_id === p.user_id)
            ? "Unsave musician"
            : "Save musician"
        }
      >
        <Bookmark
          size={18}
          fill={
            saved.some((s) => s.user_id === p.user_id) ? "currentColor" : "none"
          }
        />
      </button>
      <div className="musician-card-body">
        <a href={"#profile/" + p.user_id} className="musician-identity">
          <Avatar user={p} size={51} />
          <div>
            <h3>
              {p.name}
              {p.verified && <ShieldCheck size={14} />}
            </h3>
            <p>{p.headline}</p>
          </div>
        </a>
        <span className="location">
          <MapPin size={13} />
          {p.location}
        </span>
        <div className="tags">
          {p.genres.slice(0, 3).map((g) => (
            <span key={g} className="tag">
              {g}
            </span>
          ))}
        </div>
        <p className="musician-desc">
          {p.description ||
            "A new voice in the local scene. Get in touch to find out more."}
        </p>
        <div className="musician-meta">
          <span>
            <Star size={13} fill={p.review_count ? "currentColor" : "none"} />
            {p.review_count ? Number(p.rating).toFixed(1) : "New"}
            <small>({p.review_count} reviews)</small>
          </span>
          <strong>
            {money(p.rate)}
            <small> / gig</small>
          </strong>
        </div>
        <div className="musician-card-actions">
          <a className="btn outline" href={"#profile/" + p.user_id}>
            View profile <ArrowUpRight size={15} />
          </a>
          {user?.id !== p.user_id && (
            <button
              className="icon-btn"
              onClick={() => connect(p.user_id)}
              aria-label="Connect with musician"
            >
              {connections.some((c) => c.id === p.user_id) ? (
                <Check size={18} />
              ) : (
                <Plus size={18} />
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
function Discover({ initial = "" }) {
  const { tell } = useApp();
  const [q, setQ] = useState(initial),
    [queryText, setQueryText] = useState(initial),
    [genre, setGenre] = useState("All genres"),
    [city, setCity] = useState(""),
    [budget, setBudget] = useState(""),
    [rows, setRows] = useState([]),
    [engine, setEngine] = useState(null),
    [warning, setWarning] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    setQ(initial);
    setQueryText(initial);
  }, [initial]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      ...(queryText ? { q: queryText } : {}),
      ...(genre !== "All genres" ? { genre } : {}),
      ...(city ? { location: city } : {}),
      ...(budget ? { budget } : {}),
    });
    api("/musicians?" + params)
      .then((d) => {
        if (active) {
          setRows(d.musicians);
          setEngine(d.engine);
          setWarning(d.warning);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [queryText, genre, city, budget]);
  return (
    <>
      <PageHeading
        eyebrow="GOOD PEOPLE. GREAT SOUND."
        title="Find your kind of sound."
      >
        From intimate acoustics to full-band energy. Your next collaboration is
        right here.
      </PageHeading>
      <div className="discovery-search card">
        <div className="semantic-label">
          <AudioLines size={17} />
          <span>Tell us the vibe. We’ll find the talent.</span>
          <span className="tag">
            {engine === "keyword-fallback"
              ? "Keyword mode"
              : engine
                ? "SBERT powered"
                : "Smart discovery"}
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQueryText(q);
          }}
        >
          <Search size={20} />
          <input
            aria-label="Describe your event"
            placeholder="A soulful acoustic singer for a cosy café evening…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={1000}
          />
          <Button type="submit" loading={loading}>
            Find my sound <ArrowRight size={17} />
          </Button>
        </form>
        <div className="search-suggestions">
          <span>Try a vibe:</span>
          {[
            "Intimate acoustic café",
            "Groovy jazz band",
            "Soulful wedding vocals",
          ].map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                setQueryText(s);
              }}
            >
              {s} ↗
            </button>
          ))}
        </div>
      </div>
      <div className="genre-filters">
        {genres.map((g) => (
          <button
            key={g}
            className={genre === g ? "active" : ""}
            onClick={() => setGenre(g)}
          >
            {g === "All genres" && <SlidersHorizontal size={14} />} {g}
          </button>
        ))}
      </div>
      <div className="results-toolbar">
        <span>
          {loading
            ? "Finding your people…"
            : `${rows.length} musicians to discover`}
          {engine && (
            <small>
              {engine === "keyword-fallback"
                ? "Ranked by keyword relevance"
                : "Ranked by semantic similarity"}
            </small>
          )}
        </span>
        <div>
          <select
            aria-label="Filter by location"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">All locations</option>
            {[
              "Kuala Lumpur",
              "Petaling Jaya",
              "Shah Alam",
              "Penang",
              "Johor Bahru",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Filter by budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          >
            <option value="">Any budget</option>
            <option value="500">Up to RM 500</option>
            <option value="1000">Up to RM 1,000</option>
            <option value="2000">Up to RM 2,000</option>
          </select>
        </div>
      </div>
      {queryText && (
        <div className="search-context">
          <span>Results for “{queryText}”</span>
          <button
            onClick={() => {
              setQ("");
              setQueryText("");
              location.hash = "discover";
            }}
          >
            Clear search <X size={13} />
          </button>
        </div>
      )}
      {warning && (
        <p className="search-warning">
          <Radio size={15} />
          {warning}
        </p>
      )}
      {loading ? (
        <Loading />
      ) : error ? (
        <Empty
          title="Search needs a moment"
          action={
            <Button
              onClick={() => {
                setQ("");
                setQueryText("");
              }}
            >
              Browse all musicians
            </Button>
          }
        >
          {error}
        </Empty>
      ) : rows.length ? (
        <div className="musician-grid">
          {rows.map((p) => (
            <MusicianCard key={p.user_id} p={p} />
          ))}
        </div>
      ) : (
        <Empty
          title="A little too specific?"
          action={
            <Button
              onClick={() => {
                setQ("");
                setQueryText("");
                setGenre("All genres");
                setCity("");
                setBudget("");
              }}
            >
              Reset filters
            </Button>
          }
        >
          Try another genre, location, or budget to meet more musicians.
        </Empty>
      )}
      {engine && (
        <p className="engine-note">
          <ShieldCheck size={13} />
          {engine === "keyword-fallback"
            ? "Keyword matching is active. Start the SBERT service to enable thesis semantic recommendations."
            : "Ranked with Sentence-BERT all-MiniLM-L6-v2 and cosine similarity. Similarity reflects profile relevance, not a guarantee of suitability."}
        </p>
      )}
    </>
  );
}
function ProfilePage({ uid }) {
  const {
    user,
    save,
    saved,
    connect,
    connections,
    setModal,
    requireAuth,
    tell,
    revision,
  } = useApp();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("About");
  useEffect(() => {
    setData(null);
    setError("");
    api("/musicians/" + uid)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [uid, revision]);
  if (error) return <Empty title="Artist unavailable">{error}</Empty>;
  if (!data) return <Loading />;
  const p = data.musician;
  return (
    <>
      <a href="#discover" className="back-link">
        <ChevronLeft size={16} />
        Back to the scene
      </a>
      <div className="artist-profile card">
        <div className="artist-cover">
          <img
            src={p.cover || img("photo-1516280440614-37939bbacd81")}
            alt="Artist cover"
          />
          <span>INDEPENDENT SPIRIT. LOCAL SOUL.</span>
          <AudioLines size={50} />
        </div>
        <div className="artist-heading">
          <Avatar user={p} size={96} />
          <div className="artist-heading-actions">
            <button
              className="icon-btn bordered"
              aria-label="Save musician"
              onClick={() => save(p.user_id)}
            >
              <Bookmark
                size={19}
                fill={
                  saved.some((s) => s.user_id === p.user_id)
                    ? "currentColor"
                    : "none"
                }
              />
            </button>
            {user?.id === p.user_id ? (
              <Button
                variant="outline"
                onClick={() => setModal({ type: "edit" })}
              >
                <Settings size={16} />
                Edit profile
              </Button>
            ) : (
              <Button variant="outline" onClick={() => connect(p.user_id)}>
                {connections.some((c) => c.id === p.user_id) ? (
                  <Check size={17} />
                ) : (
                  <Plus size={17} />
                )}
                Connect
              </Button>
            )}
          </div>
          <h1>
            {p.name}
            {p.verified && <ShieldCheck size={24} />}
          </h1>
          <h3>{p.headline}</h3>
          <div className="artist-summary">
            <span className="location">
              <MapPin size={15} />
              {p.location}
            </span>
            <span>
              <Star size={15} fill="#d9ac51" color="#d9ac51" />
              {p.review_count ? Number(p.rating).toFixed(1) : "New artist"}
              <small>({p.review_count} reviews)</small>
            </span>
          </div>
          <div className="tags">
            {p.genres.map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
        </div>
        <div className="artist-booking-bar">
          <div>
            <small>Starting from</small>
            <strong>
              {money(p.rate)} <span>/ gig</span>
            </strong>
          </div>
          {user?.id !== p.user_id && (
            <div>
              <Button
                variant="outline"
                onClick={() =>
                  requireAuth(() => (location.hash = "messages/" + p.user_id))
                }
              >
                <MessageCircle size={17} />
                Let’s talk
              </Button>
              <Button
                onClick={() =>
                  requireAuth(() => {
                    if (user.role !== "organizer")
                      return tell(
                        "Booking requests are available to event organizer accounts.",
                        true,
                      );
                    setModal({ type: "book", musician: p });
                  })
                }
              >
                Request a booking <ArrowUpRight size={17} />
              </Button>
            </div>
          )}
        </div>
        <div className="profile-tabs">
          {["About", "Portfolio", "Reviews", "Availability"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Reviews" && <span>{p.review_count}</span>}
            </button>
          ))}
        </div>
        <div className="profile-tab-content">
          {tab === "About" ? (
            <>
              <h2>A little about the sound</h2>
              <p className="preserve">
                {p.description ||
                  "This artist is still finding the words. Say hello to learn more."}
              </p>
              <h3>What I bring to the stage</h3>
              <div className="skills">
                {p.skills.map((s) => (
                  <span key={s}>
                    <Music2 size={14} />
                    {s}
                  </span>
                ))}
              </div>
            </>
          ) : tab === "Portfolio" ? (
            <>
              <h2>See it. Hear it. Feel it.</h2>
              {p.portfolio.length ? (
                <div className="portfolio-grid">
                  {p.portfolio.map((item, i) => (
                    <div key={i} className="portfolio-item">
                      {item.type === "image" ? (
                        <img src={item.url} alt={item.title} />
                      ) : item.type === "audio" ? (
                        <audio controls src={item.url} />
                      ) : item.type === "video" ? (
                        <video controls src={item.url} />
                      ) : (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Play size={25} />
                          Open performance <ExternalLink size={16} />
                        </a>
                      )}
                      <h4>{item.title || "A moment on stage"}</h4>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon={Headphones} title="The next track is on its way">
                  No portfolio samples yet. Message the artist to hear more
                  about their work.
                </Empty>
              )}
            </>
          ) : tab === "Reviews" ? (
            <>
              <h2>Word from the crowd</h2>
              {data.reviews.length ? (
                data.reviews.map((r) => (
                  <div className="review" key={r.id}>
                    <Avatar user={r} size={40} />
                    <div>
                      <h4>
                        {r.name}
                        <span>
                          <Star size={13} fill="currentColor" />
                          {Number(r.rating).toFixed(1)}
                        </span>
                      </h4>
                      <small>{date(r.created_at)} · Verified booking</small>
                      <p>{r.comment}</p>
                      <div className="review-criteria">
                        <span>Performance {r.performance}/5</span>
                        <span>Professionalism {r.professionalism}/5</span>
                        <span>Communication {r.communication}/5</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty icon={Star} title="Every great artist starts somewhere">
                  Reviews appear here after a completed booking.
                </Empty>
              )}
            </>
          ) : (
            <>
              <h2>Plan the next great night</h2>
              <p>
                Bookings are checked for overlapping performances before
                confirmation. Times are in Malaysia time (UTC+8).
              </p>
              <h3>Confirmed performances</h3>
              {data.bookings.length ? (
                data.bookings.map((b, i) => (
                  <div className="availability-row" key={i}>
                    <CalendarDays size={17} />
                    {date(b.event_date)}
                    <span>
                      {b.start_time}–{b.end_time}
                    </span>
                    <span className="status accepted">Booked</span>
                  </div>
                ))
              ) : (
                <p className="muted">No upcoming confirmed bookings.</p>
              )}
              <h3>Unavailable dates</h3>
              {p.availability.length ? (
                <div className="tags">
                  {p.availability.map((d) => (
                    <span className="tag" key={d}>
                      {date(d)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  No blocked dates. Send a request to check availability.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function AuthModal({ onClose, initialMode = "login" }) {
  const { demo: demoEnabled, setUser, tell, refresh } = useApp();
  const [mode, setMode] = useState(initialMode),
    [role, setRole] = useState("organizer"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      const d = await api("/auth/" + mode, {
        method: "POST",
        body: { ...b, role },
      });
      setUser(d.user);
      refresh();
      onClose();
      tell(
        mode === "login"
          ? "Welcome back. Your scene missed you."
          : "You’re in. Let’s make some noise.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function demo(email) {
    setBusy(true);
    try {
      const d = await api("/auth/login", {
        method: "POST",
        body: { email, password: "LifeJam2026!" },
      });
      setUser(d.user);
      refresh();
      onClose();
      tell("Demo account opened. Explore the real workflows.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "login"
          ? "Back for an encore?"
          : "Find your place in the scene."
      }
      subtitle={
        mode === "login"
          ? "Good people. Great music. Welcome back."
          : "A little connection can change everything."
      }
      onClose={onClose}
    >
      <div className="auth-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Sign in
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Join the community
        </button>
      </div>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && (
          <>
            <div className="role-picker">
              {[
                ["organizer", Briefcase, "I organize events"],
                ["musician", Mic2, "I make music"],
              ].map(([r, Icon, label]) => (
                <button
                  key={r}
                  type="button"
                  className={role === r ? "active" : ""}
                  onClick={() => setRole(r)}
                >
                  <Icon size={22} />
                  {label}
                  {role === r && <Check size={14} />}
                </button>
              ))}
            </div>
            <Field label="Your name">
              <input
                name="name"
                placeholder="What should we call you?"
                required
                maxLength={100}
                autoComplete="name"
              />
            </Field>
          </>
        )}
        <Field label="Email address">
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </Field>
        <Field
          label="Password"
          hint={
            mode === "register"
              ? "At least 10 characters. Make it a good one."
              : null
          }
        >
          <input
            name="password"
            type="password"
            placeholder="Your password"
            required
            minLength={mode === "register" ? 10 : 1}
            maxLength={128}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="full">
          {mode === "login" ? "Welcome back" : "Let’s make some noise"}
          <ArrowUpRight size={17} />
        </Button>
      </form>
      {demoEnabled && (
        <div className="demo-section">
          <span>JUST TAKING A LOOK? TRY A DEMO</span>
          <div>
            <button disabled={busy} onClick={() => demo("aina@lifejam.local")}>
              <Briefcase size={15} />
              Organizer
            </button>
            <button disabled={busy} onClick={() => demo("amir@lifejam.local")}>
              <Mic2 size={15} />
              Musician
            </button>
            <button disabled={busy} onClick={() => demo("admin@lifejam.local")}>
              <ShieldCheck size={15} />
              Admin
            </button>
          </div>
          <small>
            Demo accounts share sample data. Use your own account for personal
            work.
          </small>
        </div>
      )}
    </Modal>
  );
}
function ComposeModal({ onClose }) {
  const { user, modal, refresh, tell } = useApp();
  const [body, setBody] = useState(""),
    [tag, setTag] = useState(modal.tag || "Community"),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  async function upload(e) {
    if (!e.target.files[0]) return;
    setUploading(true);
    try {
      const f = new FormData();
      f.append("file", e.target.files[0]);
      const d = await api("/uploads", { method: "POST", body: f });
      setImage(d.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      title="A little noise goes a long way."
      subtitle="Share a moment, a melody, or your next big idea."
      onClose={onClose}
    >
      <div className="compose-author">
        <Avatar user={user} />
        <div>
          <strong>{user.name}</strong>
          <select
            aria-label="Post category"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            {[
              "Community",
              "On stage",
              "Looking for talent",
              "New music",
              "Backstage thoughts",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/posts", { method: "POST", body: { body, tag, image } });
            refresh();
            onClose();
            tell("Your voice is out there.");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <textarea
          className="post-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What’s happening in your scene?"
          required
          maxLength={5000}
          autoFocus
        />
        {image && (
          <div className="compose-preview">
            <img src={image} alt="Upload preview" />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setImage("")}
              aria-label="Remove image"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer">
          <label className="upload-label">
            <ImageIcon size={19} />
            {uploading ? "Uploading…" : "Add a photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={upload}
              hidden
            />
          </label>
          <Button
            type="submit"
            loading={busy}
            disabled={uploading || !body.trim()}
          >
            Share with the scene <Send size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function BookingModal({ musician: p, onClose }) {
  const { refresh, tell } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Let’s make it a great night."
      subtitle={"Send a booking request to " + p.name + "."}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const body = Object.fromEntries(new FormData(e.currentTarget));
            await api("/bookings", {
              method: "POST",
              body: { ...body, musician_id: p.user_id },
            });
            refresh();
            onClose();
            location.hash = "bookings";
            tell("Request sent. A great night starts with a hello.");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="booking-artist">
          <Avatar user={p} />
          <div>
            <strong>{p.name}</strong>
            <small>{p.headline}</small>
          </div>
          <span>From {money(p.rate)}</span>
        </div>
        <Field label="Event name">
          <input
            name="title"
            placeholder="Sunday Sounds at The Glasshouse"
            required
            maxLength={150}
          />
        </Field>
        <div className="form-row">
          <Field label="Event date">
            <input
              type="date"
              name="event_date"
              min={new Date().toLocaleDateString("en-CA", {
                timeZone: "Asia/Kuala_Lumpur",
              })}
              required
            />
          </Field>
          <Field label="Budget (RM)">
            <input
              type="number"
              name="budget"
              min="0"
              max="1000000"
              defaultValue={p.rate}
              required
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Start time (MYT)">
            <input type="time" name="start_time" required />
          </Field>
          <Field label="End time (MYT)">
            <input type="time" name="end_time" required />
          </Field>
        </div>
        <Field label="Venue / location">
          <input
            name="location"
            placeholder="Venue name and address"
            required
            maxLength={200}
          />
        </Field>
        <Field label="Tell them about the vibe">
          <textarea
            name="details"
            placeholder="The audience, the atmosphere, the songs you’d love to hear…"
            rows={3}
            maxLength={5000}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="form-note">
          <ShieldCheck size={15} />
          The musician confirms your request. No payment is collected here.
        </p>
        <Button type="submit" loading={busy} className="full">
          Send booking request <ArrowUpRight size={17} />
        </Button>
      </form>
    </Modal>
  );
}
function AuthGate({ children }) {
  const { user, setModal } = useApp();
  return user ? (
    children
  ) : (
    <Empty
      icon={Users}
      title="Your scene is waiting."
      action={
        <Button onClick={() => setModal({ type: "auth" })}>
          Sign in to connect <ArrowUpRight size={16} />
        </Button>
      }
    >
      Sign in or create an account to make this space yours.
    </Empty>
  );
}
function Saved() {
  const { saved } = useApp();
  return (
    <AuthGate>
      <PageHeading
        eyebrow="KEEP THE GOOD ONES CLOSE"
        title="Your saved sounds."
      >
        A shortlist of the artists you’d love to work with.
      </PageHeading>
      {saved.length ? (
        <div className="musician-grid">
          {saved.map((p) => (
            <MusicianCard p={p} key={p.user_id} />
          ))}
        </div>
      ) : (
        <Empty
          icon={Bookmark}
          title="Your next favourite is out there."
          action={
            <a href="#discover" className="btn">
              Discover musicians <ArrowUpRight size={17} />
            </a>
          }
        >
          Save an artist to come back to their sound later.
        </Empty>
      )}
    </AuthGate>
  );
}
function Network() {
  const { connections, user, connect } = useApp();
  return (
    <AuthGate>
      <PageHeading eyebrow="BETTER TOGETHER" title="Your people. Your scene.">
        One connection can be the start of something loud.
      </PageHeading>
      <div className="network-count">
        <Users size={22} />
        <strong>{connections.length}</strong> creative connections
      </div>
      {connections.length ? (
        <div className="connection-grid">
          {connections.map((c) => (
            <div className="connection-card card" key={c.id}>
              <div className="connection-accent" />
              <Avatar user={c} size={67} />
              <h3>{c.name}</h3>
              <p>{c.headline || "Event organizer"}</p>
              <span className="location">
                <MapPin size={13} />
                {c.location}
              </span>
              <div>
                <a href={"#messages/" + c.id} className="btn outline small">
                  <MessageCircle size={15} />
                  Message
                </a>
                {c.role === "musician" && (
                  <a
                    href={"#profile/" + c.id}
                    className="icon-btn"
                    aria-label="View profile"
                  >
                    <ArrowUpRight size={18} />
                  </a>
                )}
                <button
                  className="icon-btn"
                  onClick={() => connect(c.id)}
                  aria-label="Remove connection"
                >
                  <X size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={Users}
          title="Every scene starts with a hello."
          action={
            <a className="btn" href="#discover">
              Meet the community <ArrowUpRight size={16} />
            </a>
          }
        >
          Connect with artists to build your creative circle.
        </Empty>
      )}
    </AuthGate>
  );
}
function Bookings() {
  const { user, setModal, tell, refresh, revision } = useApp();
  const [rows, setRows] = useState([]),
    [tab, setTab] = useState("All"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(null);
  useEffect(() => {
    if (!user) return;
    api("/bookings")
      .then((d) => setRows(d.bookings))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, revision]);
  async function status(b, status) {
    setBusy(b.id);
    try {
      await api("/bookings/" + b.id, { method: "PATCH", body: { status } });
      refresh();
      tell("Booking " + status + ".");
    } catch (e) {
      tell(e.message, true);
    } finally {
      setBusy(null);
    }
  }
  const filtered = rows.filter(
    (b) => tab === "All" || b.status === tab.toLowerCase(),
  );
  return (
    <AuthGate>
      <PageHeading
        eyebrow="FROM A HELLO TO AN ENCORE"
        title={
          user?.role === "musician"
            ? "Your next stages."
            : "Good nights start here."
        }
      >
        Manage your bookings, keep the details together, and make it happen.
      </PageHeading>
      <div className="booking-stats">
        {[
          ["Pending", "pending"],
          ["Confirmed", "accepted"],
          ["Completed", "completed"],
        ].map(([label, status]) => (
          <div className="card" key={status}>
            <CalendarDays size={19} />
            <strong>{rows.filter((b) => b.status === status).length}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="tabs-scroll">
        {[
          "All",
          "Pending",
          "Accepted",
          "Completed",
          "Rejected",
          "Cancelled",
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Empty title="Couldn’t load bookings">{error}</Empty>
      ) : filtered.length ? (
        filtered.map((b) => (
          <article className="booking-card card" key={b.id}>
            <div className="booking-card-heading">
              <span className={`status ${b.status}`}>
                {b.status === "accepted" ? "Confirmed" : b.status}
              </span>
              <span>#{String(b.id).padStart(4, "0")}</span>
            </div>
            <h2>{b.title}</h2>
            <div className="booking-person">
              <Avatar
                user={{
                  name:
                    user?.role === "musician"
                      ? b.organizer_name
                      : b.musician_name,
                  avatar:
                    user?.role === "musician"
                      ? b.organizer_avatar
                      : b.musician_avatar,
                }}
                size={33}
              />
              <span>
                {user?.role === "musician" ? "Organized by" : "Performing with"}{" "}
                <strong>
                  {user?.role === "musician"
                    ? b.organizer_name
                    : b.musician_name}
                </strong>
              </span>
            </div>
            <div className="booking-info">
              <span>
                <CalendarDays size={16} />
                {date(b.event_date)}
              </span>
              <span>
                <Clock size={16} />
                {b.start_time} – {b.end_time} MYT
              </span>
              <span>
                <MapPin size={16} />
                {b.location}
              </span>
              <strong>{money(b.budget)}</strong>
            </div>
            {b.details && <p>{b.details}</p>}
            <div className="booking-actions">
              <a
                href={
                  "#messages/" +
                  (user?.id === b.organizer_id ? b.musician_id : b.organizer_id)
                }
                className="btn ghost small"
              >
                <MessageCircle size={16} />
                Message
              </a>
              <div>
                {user?.id === b.musician_id && b.status === "pending" && (
                  <>
                    <Button
                      variant="outline small"
                      disabled={busy === b.id}
                      onClick={() => status(b, "rejected")}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="small"
                      loading={busy === b.id}
                      onClick={() => status(b, "accepted")}
                    >
                      Accept booking <Check size={15} />
                    </Button>
                  </>
                )}
                {["pending", "accepted"].includes(b.status) && (
                  <Button
                    variant="ghost small danger"
                    disabled={busy === b.id}
                    onClick={() => status(b, "cancelled")}
                  >
                    Cancel
                  </Button>
                )}
                {user?.id === b.organizer_id && b.status === "accepted" && (
                  <Button
                    variant="small"
                    disabled={
                      busy === b.id ||
                      new Date(
                        String(b.event_date).slice(0, 10) +
                          "T" +
                          b.end_time +
                          ":00+08:00",
                      ) > new Date()
                    }
                    onClick={() => status(b, "completed")}
                  >
                    Mark complete <Check size={15} />
                  </Button>
                )}
                {user?.id === b.organizer_id &&
                  b.status === "completed" &&
                  !b.review_id && (
                    <Button
                      variant="small"
                      onClick={() => setModal({ type: "review", booking: b })}
                    >
                      <Star size={15} />
                      Leave a review
                    </Button>
                  )}
                {b.review_id && (
                  <span className="reviewed">
                    <CheckCheck size={15} />
                    Reviewed
                  </span>
                )}
              </div>
            </div>
          </article>
        ))
      ) : (
        <Empty
          icon={CalendarDays}
          title="The calendar is full of possibilities."
          action={
            user?.role === "organizer" ? (
              <a href="#discover" className="btn">
                Find your next artist <ArrowUpRight size={16} />
              </a>
            ) : null
          }
        >
          No {tab === "All" ? "" : tab.toLowerCase() + " "}bookings yet. Your
          next great gig starts with a connection.
        </Empty>
      )}
    </AuthGate>
  );
}
function ReviewModal({ booking, onClose }) {
  const { refresh, tell } = useApp();
  const [scores, setScores] = useState({
      performance: 5,
      professionalism: 5,
      communication: 5,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Give a little love back."
      subtitle={
        "Your experience with " +
        booking.musician_name +
        " at " +
        booking.title +
        "."
      }
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/reviews", {
              method: "POST",
              body: {
                booking_id: booking.id,
                ...scores,
                comment: new FormData(e.currentTarget).get("comment"),
              },
            });
            refresh();
            onClose();
            tell("Review shared. Thanks for supporting the scene.");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {Object.entries(scores).map(([key, value]) => (
          <div className="rating-input" key={key}>
            <span>{key}</span>
            <div>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setScores({ ...scores, [key]: n })}
                  aria-label={`${key}: ${n} stars`}
                >
                  <Star
                    size={26}
                    fill={n <= value ? "#dfb451" : "none"}
                    color={n <= value ? "#dfb451" : "#c9c9c1"}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field label="Tell us about the experience">
          <textarea
            name="comment"
            rows={4}
            placeholder="What made this performance memorable?"
            required
            maxLength={2000}
          />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={busy}>
          Share your review <Star size={16} />
        </Button>
      </form>
    </Modal>
  );
}
function Messages({ initial }) {
  const { user, tell, revision, connections } = useApp();
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(Number(initial) || null),
    [newPerson, setNewPerson] = useState(null),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(() => {
    if (user)
      api("/messages")
        .then((d) => {
          setRows(d.messages);
          setError("");
        })
        .catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, revision]);
  useEffect(() => {
    if (initial) {
      setSelected(Number(initial));
      api("/people/" + initial)
        .then((d) => setNewPerson(d.person))
        .catch(() => {});
    }
  }, [initial]);
  const people = new Map();
  rows.forEach((m) => {
    const mine = m.sender_id === user?.id;
    people.set(mine ? m.recipient_id : m.sender_id, {
      id: mine ? m.recipient_id : m.sender_id,
      name: mine ? m.recipient_name : m.sender_name,
      avatar: mine ? m.recipient_avatar : m.sender_avatar,
      last: m.body,
    });
  });
  if (newPerson && !people.has(newPerson.id))
    people.set(newPerson.id, newPerson);
  connections.forEach((c) => {
    if (!people.has(c.id)) people.set(c.id, c);
  });
  const current = people.get(selected);
  const conversation = rows.filter(
    (m) => m.sender_id === selected || m.recipient_id === selected,
  );
  useEffect(() => {
    if (user && selected)
      api("/messages/" + selected + "/read", { method: "POST" }).catch(
        () => {},
      );
  }, [user, selected, rows.length]);
  return (
    <AuthGate>
      <PageHeading
        eyebrow="IT STARTS WITH A HELLO"
        title="Behind every great gig, a good conversation."
      >
        Keep your collaborations in one place. Conversations refresh every few
        seconds.
      </PageHeading>
      {error && <p className="form-error">{error}</p>}
      <div
        className={`messages-layout card ${selected ? "has-selection" : ""}`}
      >
        <div className="conversation-list">
          <h3>
            Your conversations <MessageCircle size={18} />
          </h3>
          {[...people.values()].map((p) => (
            <button
              className={selected === p.id ? "active" : ""}
              key={p.id}
              onClick={() => setSelected(p.id)}
            >
              <Avatar user={p} size={43} />
              <div>
                <strong>{p.name}</strong>
                <span>{p.last || "Say hello. Make something happen."}</span>
              </div>
            </button>
          ))}
          {!people.size && (
            <p className="muted">
              Connect with musicians to start a conversation.
            </p>
          )}
        </div>
        <div className="conversation">
          {current ? (
            <>
              <div className="conversation-header">
                <button
                  className="icon-btn conversation-back"
                  onClick={() => setSelected(null)}
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={18} />
                </button>
                <Avatar user={current} size={37} />
                <div>
                  <strong>{current.name}</strong>
                  <small>Your next collaboration starts here</small>
                </div>
              </div>
              <div className="message-bubbles">
                {conversation.length ? (
                  conversation.map((m) => (
                    <div
                      className={`message-bubble ${m.sender_id === user?.id ? "mine" : ""}`}
                      key={m.id}
                    >
                      <p>{m.body}</p>
                      <small>
                        {new Date(m.created_at).toLocaleString("en-MY", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                        {m.sender_id === user?.id && m.read_at && (
                          <CheckCheck size={12} />
                        )}
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="chat-start">
                    <AudioLines size={37} />
                    <h3>A good hello goes a long way.</h3>
                    <p>Talk about the music, the venue, the possibilities.</p>
                  </div>
                )}
              </div>
              <form
                className="message-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!body.trim()) return;
                  setBusy(true);
                  try {
                    await api("/messages", {
                      method: "POST",
                      body: { recipient_id: selected, body },
                    });
                    setBody("");
                    load();
                  } catch (e) {
                    tell(e.message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Start something good…"
                  aria-label="Message"
                  rows={2}
                  maxLength={4000}
                />
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!body.trim()}
                  aria-label="Send message"
                >
                  <Send size={19} />
                </Button>
              </form>
            </>
          ) : (
            <Empty icon={MessageCircle} title="Find your next conversation.">
              Choose someone on the left, or discover a new artist and say
              hello.
            </Empty>
          )}
        </div>
      </div>
    </AuthGate>
  );
}
function SearchHistory() {
  const { user, tell } = useApp();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (user)
      api("/history")
        .then((d) => setRows(d.history))
        .catch((e) => tell(e.message, true));
  }, [user]);
  return (
    <AuthGate>
      <PageHeading
        eyebrow="FOLLOW YOUR CURIOSITY"
        title="Sounds you’ve searched for."
        action={
          rows?.length ? (
            <Button
              variant="ghost small danger"
              onClick={async () => {
                try {
                  await api("/history", { method: "DELETE" });
                  setRows([]);
                  tell("Search history cleared.");
                } catch (e) {
                  tell(e.message, true);
                }
              }}
            >
              <Trash2 size={15} />
              Clear history
            </Button>
          ) : null
        }
      >
        Pick up where your last idea left off.
      </PageHeading>
      {!rows ? (
        <Loading />
      ) : rows.length ? (
        <div className="card history-list">
          {rows.map((r) => (
            <a key={r.id} href={"#discover/" + encodeURIComponent(r.query)}>
              <span className="history-icon">
                <History size={19} />
              </span>
              <div>
                <strong>{r.query}</strong>
                <small>
                  {date(r.created_at)} ·{" "}
                  {r.engine === "keyword-fallback" ? "Keywords" : "SBERT"} ·{" "}
                  {r.duration_ms} ms
                </small>
              </div>
              <ArrowUpRight size={18} />
            </a>
          ))}
        </div>
      ) : (
        <Empty
          icon={History}
          title="Your next idea is a search away."
          action={
            <a href="#discover" className="btn">
              Find your sound <ArrowUpRight size={16} />
            </a>
          }
        >
          Your natural-language searches will appear here.
        </Empty>
      )}
    </AuthGate>
  );
}
function Notifications({ items }) {
  const { user, tell, refresh } = useApp();
  return (
    <AuthGate>
      <PageHeading
        eyebrow="IN THE LOOP"
        title="A little buzz from your scene."
        action={
          items.some((n) => !n.read_at) ? (
            <Button
              variant="ghost small"
              onClick={async () => {
                try {
                  await api("/notifications/read", { method: "POST" });
                  refresh();
                } catch (e) {
                  tell(e.message, true);
                }
              }}
            >
              <CheckCheck size={16} />
              Mark all read
            </Button>
          ) : null
        }
      >
        Bookings, messages, and moments worth knowing about.
      </PageHeading>
      {items.length ? (
        <div className="card notification-list">
          {items.map((n) => (
            <div className={!n.read_at ? "unread" : ""} key={n.id}>
              <span className="notification-icon">
                <Bell size={20} />
              </span>
              <div>
                <p>{n.body}</p>
                <small>{date(n.created_at)}</small>
              </div>
              {!n.read_at && <span className="unread-dot" />}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={Bell} title="All quiet, for now.">
          We’ll keep you posted when something good happens.
        </Empty>
      )}
    </AuthGate>
  );
}
function EditProfile({ onClose }) {
  const { user, setUser, refresh, tell } = useApp();
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [portfolio, setPortfolio] = useState([]),
    [avatar, setAvatar] = useState(user.avatar || "");
  useEffect(() => {
    if (user.role === "musician")
      api("/musicians/" + user.id)
        .then((d) => {
          setData(d.musician);
          setPortfolio(d.musician.portfolio);
        })
        .catch((e) => setError(e.message));
    else setData({});
  }, []);
  async function upload(e, where) {
    if (!e.target.files[0]) return;
    setUploading(true);
    try {
      const f = new FormData();
      f.append("file", e.target.files[0]);
      const d = await api("/uploads", { method: "POST", body: f });
      if (where === "avatar") setAvatar(d.url);
      else
        setPortfolio((p) => [
          ...p,
          { url: d.url, type: d.type, title: e.target.files[0].name },
        ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      title="Make your profile sound like you."
      subtitle="The more you share, the easier it is to find your people."
      onClose={onClose}
      wide
    >
      {!data ? (
        <Loading />
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const b = Object.fromEntries(new FormData(e.currentTarget));
              const d = await api("/profile", {
                method: "PATCH",
                body: {
                  ...b,
                  avatar,
                  genres: (b.genres || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  skills: (b.skills || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  availability: (b.availability || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  portfolio,
                },
              });
              setUser(d.user);
              refresh();
              onClose();
              tell("Profile updated. That’s more like you.");
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="edit-avatar">
            <Avatar user={{ name: user.name, avatar }} size={65} />
            <label className="upload-label">
              <ImageIcon size={16} />
              {uploading ? "Uploading…" : "Change profile photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => upload(e, "avatar")}
              />
            </label>
          </div>
          <div className="form-row">
            <Field label="Your name">
              <input
                name="name"
                defaultValue={user.name}
                required
                maxLength={100}
              />
            </Field>
            <Field label="Location">
              <input
                name="location"
                defaultValue={user.location}
                required
                maxLength={100}
              />
            </Field>
          </div>
          <Field label="A little about you">
            <textarea
              name="bio"
              defaultValue={user.bio || ""}
              maxLength={5000}
              rows={2}
            />
          </Field>
          {user.role === "musician" && (
            <>
              <Field label="Professional headline">
                <input
                  name="headline"
                  defaultValue={data.headline || ""}
                  placeholder="Acoustic guitarist & singer"
                  maxLength={200}
                />
              </Field>
              <Field
                label="Your sound & experience"
                hint="Describe your genres, performance style, event experience and instruments. SBERT uses this to match you with the right events."
              >
                <textarea
                  name="description"
                  defaultValue={data.description || ""}
                  rows={4}
                  maxLength={5000}
                />
              </Field>
              <div className="form-row">
                <Field label="Genres" hint="Separate each with a comma">
                  <input
                    name="genres"
                    defaultValue={data.genres?.join(", ")}
                    placeholder="Acoustic, Indie, Folk"
                  />
                </Field>
                <Field
                  label="Skills / instruments"
                  hint="Separate each with a comma"
                >
                  <input
                    name="skills"
                    defaultValue={data.skills?.join(", ")}
                    placeholder="Guitar, Vocals, Songwriting"
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Starting rate (RM / gig)">
                  <input
                    name="rate"
                    type="number"
                    min="0"
                    max="100000"
                    defaultValue={data.rate || 0}
                    required
                  />
                </Field>
                <Field label="Cover image URL">
                  <input
                    name="cover"
                    type="text"
                    defaultValue={data.cover || ""}
                    placeholder="https://…"
                  />
                </Field>
              </div>
              <Field
                label="Unavailable dates"
                hint="Comma-separated dates in YYYY-MM-DD format"
              >
                <input
                  name="availability"
                  defaultValue={data.availability?.join(", ")}
                  placeholder="2026-12-25, 2026-12-31"
                />
              </Field>
              <div className="portfolio-editor">
                <h3>Performance portfolio</h3>
                <p>
                  Upload photos, audio, or video (up to 20 MB), or link to an
                  external performance.
                </p>
                {portfolio.map((p, i) => (
                  <div className="portfolio-edit-row" key={i}>
                    <Music2 size={17} />
                    <input
                      value={p.title}
                      aria-label="Portfolio title"
                      placeholder="Performance title"
                      onChange={(e) =>
                        setPortfolio(
                          portfolio.map((v, j) =>
                            j === i ? { ...v, title: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open portfolio item"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label="Remove portfolio item"
                      onClick={() =>
                        setPortfolio(portfolio.filter((_, j) => j !== i))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div className="portfolio-add">
                  <label className="upload-label">
                    <Plus size={17} />
                    Upload a performance
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/ogg,video/mp4"
                      hidden
                      onChange={(e) => upload(e, "portfolio")}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      setPortfolio([
                        ...portfolio,
                        { title: "", url: "", type: "link" },
                      ])
                    }
                  >
                    Add a link <ExternalLink size={14} />
                  </button>
                </div>
                {portfolio
                  .filter((p) => p.type === "link")
                  .map((p) => {
                    const i = portfolio.indexOf(p);
                    return (
                      <Field label={"Performance link " + (i + 1)} key={i}>
                        <input
                          type="url"
                          required
                          value={p.url}
                          placeholder="https://youtube.com/watch?v=…"
                          onChange={(e) =>
                            setPortfolio(
                              portfolio.map((v, j) =>
                                j === i ? { ...v, url: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </Field>
                    );
                  })}
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            loading={busy}
            disabled={uploading}
            className="full"
          >
            Save your profile <Check size={17} />
          </Button>
        </form>
      )}
    </Modal>
  );
}
function Admin() {
  const { user, tell } = useApp();
  const [data, setData] = useState(null),
    [tab, setTab] = useState("Accounts"),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (user?.role === "admin")
      api("/admin/overview")
        .then(setData)
        .catch((e) => tell(e.message, true));
  }, [user]);
  useEffect(load, [load]);
  async function update(url, body) {
    try {
      await api(url, { method: "PATCH", body });
      load();
      tell("Moderation change saved.");
    } catch (e) {
      tell(e.message, true);
    }
  }
  async function maintenance(action) {
    setBusy(true);
    try {
      const r = await api("/admin/" + action, { method: "POST" });
      tell(r.message);
      load();
    } catch (e) {
      tell(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthGate>
      {user?.role !== "admin" ? (
        <Empty icon={ShieldCheck} title="This studio is for administrators.">
          Use an administrator account to manage the platform.
        </Empty>
      ) : (
        <>
          <PageHeading
            eyebrow="KEEPING THE SCENE IN HARMONY"
            title="The admin studio."
          >
            Manage accounts, moderate content, and keep recommendations healthy.
          </PageHeading>
          {!data ? (
            <Loading />
          ) : (
            <>
              <div className="admin-stats">
                {[
                  ["Members", data.users.length],
                  ["Bookings", data.counts.bookings],
                  ["Searches", data.counts.searches],
                  ["Embeddings", data.counts.embeddings],
                ].map(([k, v]) => (
                  <div className="card" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="tabs-scroll">
                {[
                  "Accounts",
                  "Profiles",
                  "Posts",
                  "Reviews",
                  "Search activity",
                  "Maintenance",
                ].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="card admin-content">
                {tab === "Accounts" ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Manage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.users.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <strong>{u.name}</strong>
                              <small>{u.email}</small>
                            </td>
                            <td>{u.role}</td>
                            <td>
                              <span
                                className={
                                  "status " +
                                  (u.suspended ? "rejected" : "accepted")
                                }
                              >
                                {u.suspended ? "Suspended" : "Active"}
                              </span>
                            </td>
                            <td>
                              {u.id !== user.id && (
                                <Button
                                  variant="outline small"
                                  onClick={() =>
                                    update("/admin/users/" + u.id, {
                                      suspended: !u.suspended,
                                    })
                                  }
                                >
                                  {u.suspended ? "Restore" : "Suspend"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : tab === "Profiles" ? (
                  data.profiles.map((p) => (
                    <div className="moderation-row" key={p.id}>
                      <div>
                        <strong>{p.name}</strong>
                        <p>{p.headline}</p>
                        <small>
                          {p.portfolio.length} portfolio items ·{" "}
                          {p.hidden ? "Hidden" : "Visible"}
                        </small>
                        <div className="tags">
                          {p.portfolio.map((item, i) => (
                            <a
                              className="tag"
                              href={item.url}
                              key={i}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.title || item.type}
                              <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="outline small"
                        onClick={() =>
                          update("/admin/profiles/" + p.id, {
                            hidden: !p.hidden,
                          })
                        }
                      >
                        {p.hidden ? "Restore" : "Hide profile"}
                      </Button>
                    </div>
                  ))
                ) : tab === "Posts" ? (
                  data.posts.map((p) => (
                    <div className="moderation-row" key={p.id}>
                      <div>
                        <strong>{p.name}</strong>
                        <p>{p.body}</p>
                        {p.image && (
                          <a
                            href={p.image}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View uploaded photo ↗
                          </a>
                        )}
                        <small>
                          {date(p.created_at)} ·{" "}
                          {p.hidden ? "Hidden" : "Visible"}
                        </small>
                      </div>
                      <Button
                        variant="outline small"
                        onClick={() =>
                          update("/admin/posts/" + p.id, { hidden: !p.hidden })
                        }
                      >
                        {p.hidden ? "Restore" : "Hide post"}
                      </Button>
                    </div>
                  ))
                ) : tab === "Reviews" ? (
                  data.reviews.length ? (
                    data.reviews.map((r) => (
                      <div className="moderation-row" key={r.id}>
                        <div>
                          <strong>
                            {r.name} → {r.musician_name}
                          </strong>
                          <p>{r.comment}</p>
                          <small>
                            {r.rating}/5 · {r.hidden ? "Hidden" : "Visible"}
                          </small>
                        </div>
                        <Button
                          variant="outline small"
                          onClick={() =>
                            update("/admin/reviews/" + r.id, {
                              hidden: !r.hidden,
                            })
                          }
                        >
                          {r.hidden ? "Restore" : "Hide review"}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <Empty icon={Star} title="Nothing to moderate.">
                      Reviews appear after completed bookings.
                    </Empty>
                  )
                ) : tab === "Search activity" ? (
                  <>
                    <h3>Recommendation performance</h3>
                    <p className="muted">
                      The latest 100 searches with model and measured API
                      response times.
                    </p>
                    {data.searches.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Search / member</th>
                              <th>Model</th>
                              <th>Latency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.searches.map((s) => (
                              <tr key={s.id}>
                                <td>
                                  <strong>{s.query}</strong>
                                  <small>
                                    {s.name} · {date(s.created_at)}
                                  </small>
                                </td>
                                <td className="model-cell">{s.engine}</td>
                                <td>{s.duration_ms} ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No searches recorded yet.</p>
                    )}
                  </>
                ) : (
                  <div className="maintenance">
                    <h3>Keep the good things running.</h3>
                    <p>
                      Maintain database statistics, clear expired sessions,
                      rebuild semantic embeddings, and export data for a backup.
                    </p>
                    <Button
                      variant="outline"
                      loading={busy}
                      onClick={() => maintenance("maintenance")}
                    >
                      <Settings size={16} />
                      Analyze tables & clean sessions
                    </Button>
                    <Button
                      variant="outline"
                      loading={busy}
                      onClick={() => maintenance("reindex")}
                    >
                      <RefreshCw size={16} />
                      Rebuild SBERT embeddings
                    </Button>
                    <a
                      className="btn outline"
                      href="/api/admin/export"
                      download
                    >
                      <Download size={16} />
                      Export database data
                    </a>
                    <small>
                      Exports contain personal data. Store them securely.
                      Password hashes and sessions are excluded.
                    </small>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </AuthGate>
  );
}
createRoot(document.getElementById("root")).render(<App />);
