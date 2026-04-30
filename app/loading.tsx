export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg, #f5ede0)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt=""
        width={80}
        height={80}
        style={{ borderRadius: '20px', opacity: 0.9 }}
      />
    </div>
  )
}
