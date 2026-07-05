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
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <path fill="#fff"
            d="M6.4 8.9C7.1 6.4 9.3 4.6 12 4.6s4.9 1.8 5.6 4.3c1.7.2 3 1.7 3 3.5 0 1.6-1 2.9-2.5 3.4v-.1H6c-1.5-.5-2.6-1.9-2.6-3.4 0-1.8 1.3-3.3 3-3.4Z" />
          <path fill="#fff"
            d="M7.4 16.3h9.2v2.6c0 .8-.6 1.4-1.4 1.4H8.8c-.8 0-1.4-.6-1.4-1.4z" />
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
