export default function LoadingScreen() {
  var COLORS = {
    bg: "#F2F6F8",
    primary: "#2F6586",
    secondary: "#6BA6C9",
    line: "#E3EAEE",
    ink: "#2C3338",
    ink2: "#8A949B"
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        fontFamily: "'Nunito', system-ui, sans-serif",
        color: COLORS.ink,
        padding: 24,
        zIndex: 999
      }}
    >
      <style>{`
        @keyframes mf-pulse {0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.85}}
        @keyframes mf-spin {to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){
          .mf-logo{animation:none !important}
          .mf-spinner{animation-duration:1.8s !important}
        }
      `}</style>

      <div
        className="mf-logo"
        style={{
          width: 74,
          height: 74,
          borderRadius: 22,
          background: COLORS.secondary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 26px -10px rgba(107,166,201,.5)",
          animation: "mf-pulse 1.6s ease-in-out infinite"
        }}
      >
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path fill="#fff"
            d="M6.3 13.9C4 13.9 2.2 12.1 2.2 9.9c0-1.9 1.4-3.6 3.3-4C6 3.7 7.9 2.2 10.2 2.2c1.6 0 3 .7 4 1.9.5-.2 1.1-.4 1.7-.4 2.1 0 3.9 1.7 3.9 3.9 0 .3 0 .6-.1.8 1 .7 1.7 1.8 1.7 3.1 0 2.1-1.8 3.9-3.9 3.9-.1 0-.1 0-.2-.1H6.3Z" />
          <path fill="#fff"
            d="M6.8 15.3h10.4v3.4c0 1-.8 1.8-1.8 1.8H8.6c-1 0-1.8-.8-1.8-1.8z" />
          <path stroke="#6BA6C9" strokeWidth="1" strokeLinecap="round"
            d="M10 15.8v4.6M14 15.8v4.6" />
        </svg>
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>
        Menu Famiglia
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink2, marginTop: -10 }}>
        Pianifica. Bilancia. Condividi.
      </div>

      <div
        className="mf-spinner"
        role="status"
        aria-label="Caricamento"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "3px solid " + COLORS.line,
          borderTopColor: COLORS.secondary,
          animation: "mf-spin .8s linear infinite",
          marginTop: 6
        }}
      />
    </div>
  );
}
