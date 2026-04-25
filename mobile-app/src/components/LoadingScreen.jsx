export default function LoadingScreen({ message = 'Loading...', compact = false }) {
  return (
    <div className={`loading-screen ${compact ? 'loading-screen--compact' : ''}`}>
      <div className="loading-screen__orb" />
      <p className="loading-screen__text">{message}</p>
    </div>
  );
}
