import { useEffect, useState, useRef } from "react";

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || "store-001-kiosk-1";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [helloHtml, setHelloHtml] = useState("");
  const [ts, setTs] = useState(Date.now());
  const [isInIframe, setIsInIframe] = useState(false);
  const prevRoute = useRef(null);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile?machineId=${MACHINE_ID}`);
      if (!res.ok) {
        console.error(`fetchProfile failed: ${res.status}`);
        return;
      }
      const p = await res.json();
      setProfile(p);

      // Fetch hello only if softwareRoute changed or is initial fetch
      if (p.softwareRoute && p.softwareRoute !== prevRoute.current) {
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
    if (isInIframe) return;
    fetchProfile(); // Initial fetch
    const id = setInterval(fetchProfile, 900_000); // Every 15 minutes
    return () => clearInterval(id);
  }, [isInIframe]);

  if (isInIframe) {
    // Render static content without fetches
    return (
      <div style={{ fontFamily: "system-ui", padding: 16 }}>
        <h1>Hello from Assigned Route: {profile?.softwareRoute ?? "Unknown"}</h1>
        <p><b>Machine:</b> {MACHINE_ID}</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      <h1>Location-Aware Rollout Demo</h1>
      <p><b>Machine:</b> {MACHINE_ID}</p>
      <p><b>Assigned Route:</b> {profile?.softwareRoute ?? "(loading...)"}</p>
      <button onClick={fetchProfile}>Refresh Profile</button>{" "}
      <button onClick={fetchHello} disabled={!profile}>Fetch Hello (via Istio)</button>
      <p style={{ opacity: 0.7, fontSize: 12 }}>
        Last fetch: {new Date(ts).toLocaleTimeString()}
      </p>
      <div
        style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}
        dangerouslySetInnerHTML={{ __html: helloHtml }}
      />
    </div>
  );
}