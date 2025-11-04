export const LoadingOverlay: React.FC<{ tip?: string }> = ({
  tip = 'Data loading…'
}) => (
  <>
    <style>
      {`
            @keyframes sip-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
    </style>
    <div
      aria-busy='true'
      role='status'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.35)', // darker mask
        backdropFilter: 'blur(1px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      {/* inline spinner + text (no box/card) */}
      <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
        <div
          aria-hidden='true'
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.35)',
            borderTopColor: '#ffffff',
            animation: 'sip-spin 0.9s linear infinite'
          }}
        />
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
          {tip}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
          Please wait…
        </div>
      </div>
    </div>
  </>
)
