import { useEffect, useState, useRef } from "react";
import './App.css';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || "store-001-kiosk-1";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [ts, setTs] = useState(Date.now());
  const prevRoute = useRef(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile?machineId=${MACHINE_ID}`);
      if (!res.ok) {
        console.error(`fetchProfile failed: ${res.status}`);
        return;
      }
      const p = await res.json();
      setProfile(p);

      // If softwareRoute changed, reload the app to get the new version with header
      if (p.softwareRoute && p.softwareRoute !== prevRoute.current) {
        if (prevRoute.current !== null) {
          console.log(`Route changed from ${prevRoute.current} to ${p.softwareRoute}, reloading app...`);
          // Store new route in sessionStorage before reload
          sessionStorage.setItem('softwareRoute', p.softwareRoute);
          window.location.reload(true);
          return;
        }
        prevRoute.current = p.softwareRoute;
      }
    } catch (error) {
      console.error("fetchProfile error:", error);
    }
  };

  useEffect(() => {
    // Check if we have a stored route from previous session (post-reload)
    const storedRoute = sessionStorage.getItem('softwareRoute');
    if (storedRoute && !prevRoute.current) {
      prevRoute.current = storedRoute;
      setProfile({ softwareRoute: storedRoute });
      sessionStorage.removeItem('softwareRoute'); // Clear after use
    }

    fetchProfile(); // Initial fetch
    const id = setInterval(fetchProfile, 900_000); // Every 15 minutes
    return () => clearInterval(id);
  }, []);

  const routeClass = 'v1-background'

  return (
    <div className={`app ${routeClass}`}>
      <h1>Location-Aware Rollout Demo</h1>
      <p><b>Machine:</b> {MACHINE_ID}</p>
      <p><b>Assigned Route:</b> {profile?.softwareRoute ?? "(loading...)"}</p>
      <button onClick={fetchProfile}>Refresh Profile</button>
      <p className="last-fetch">
        Last fetch: {new Date(ts).toLocaleTimeString()}
      </p>
    </div>
  );
}