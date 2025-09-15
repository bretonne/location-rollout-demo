import { useEffect, useState } from "react";

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || "store-001-kiosk-1";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [helloHtml, setHelloHtml] = useState("");
  const [ts, setTs] = useState(Date.now());

  const fetchProfile = async () => {
    const res = await fetch(`/api/profile?machineId=${MACHINE_ID}`);
    if (!res.ok) return;
    const p = await res.json();
    setProfile(p);
  };

  const fetchHello = async () => {
    if (!profile?.softwareRoute) return;
    const res = await fetch("/hello", {
      headers: { "x-software-route": profile.softwareRoute }
    });
    const text = await res.text();
    setHelloHtml(text);
    setTs(Date.now());
  };

  useEffect(() => {
    fetchProfile();
    const id = setInterval(fetchProfile, 60_000); // poll every minute (heartbeat)
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchHello();
  }, [profile?.softwareRoute]);

  return (
    <div style={{ fontFamily:"system-ui", padding: 16 }}>
      <h1>Location-Aware Rollout Demo</h1>
      <p><b>Machine:</b> {MACHINE_ID}</p>
      <p><b>Assigned Route:</b> {profile?.softwareRoute ?? "(loading...)"}</p>
      <button onClick={fetchProfile}>Refresh Profile</button>{" "}
      <button onClick={fetchHello} disabled={!profile}>Fetch Hello (via Istio)</button>
      <p style={{opacity:0.7, fontSize: 12}}>Last fetch: {new Date(ts).toLocaleTimeString()}</p>
      <div style={{border:"1px solid #ddd", borderRadius:8, overflow:"hidden"}}>
        <iframe
          title="hello"
          srcDoc={helloHtml}
          style={{ width:"100%", height: 300, border: "0" }}
        />
      </div>
    </div>
  );
}
