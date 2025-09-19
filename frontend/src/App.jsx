import { useEffect, useState, useRef } from "react";
import './App.css';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || "store-001-kiosk-1";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [helloHtml, setHelloHtml] = useState("");
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

      // If softwareRoute changed, fetch the new UI version with header and replace document
      if (p.softwareRoute && p.softwareRoute !== prevRoute.current) {
        if (prevRoute.current !== null) {
          console.log(`Route changed from ${prevRoute.current} to ${p.softwareRoute}, fetching new UI version...`);
          try {
            const uiRes = await fetch('/', {
              headers: { 'x-software-route': p.softwareRoute },
              cache: 'no-store'  // Force no cache, similar to hard reload
            });
            if (!uiRes.ok) {
              console.error(`Failed to fetch new UI: ${uiRes.status}`);
              return;
            }
            const html = await uiRes.text();
            document.open();
            document.write(html);
            document.close();
          } catch (error) {
            console.error("Error fetching new UI:", error);
          }
          return;
        }
        await fetchHello();
        prevRoute.current = p.softwareRoute;
      }
    } catch (error) {
      console.error("fetchProfile error:", error);
    }
  };

  const fetchHello = async () => {
    if (!profile?.softwareRoute) {
      console.warn("No softwareRoute, skipping fetchHello");
      return;
    }
    try {
      const res = await fetch("/hello", {
        headers: { "x-software-route": profile.softwareRoute }
      });
      if (!res.ok) {
        console.error(`fetchHello failed: ${res.status}`);
        return;
      }
      const text = await res.text();
      setHelloHtml(text);
      setTs(Date.now());
    } catch (error) {
      console.error("fetchHello error:", error);
    }
  };

  useEffect(() => {
    fetchProfile(); // Initial fetch
    const id = setInterval(fetchProfile, 900_000); // Every 15 minutes
    return () => clearInterval(id);
  }, []);

  const routeClass = `v1-background`;

  return (
    <div className={`app ${routeClass}`}>
      <h1>Location-Aware Rollout Demo</h1>
      <p><b>Machine:</b> {MACHINE_ID}</p>
      <p><b>Assigned Route:</b> {profile?.softwareRoute ?? "(loading...)"}</p>
      <button onClick={fetchProfile}>Refresh Profile</button>{" "}
      <button onClick={fetchHello} disabled={!profile}>Fetch Hello (via Istio)</button>
      <p className="last-fetch">
        Last fetch: {new Date(ts).toLocaleTimeString()}
      </p>
      <div
        className="hello-container"
        dangerouslySetInnerHTML={{ __html: helloHtml }}
      />
    </div>
  );
}