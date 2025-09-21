import { useEffect, useState, useRef } from "react";
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [ts, setTs] = useState(Date.now());
  const prevRoute = useRef(null);

  const machineId = window.location.pathname.replace(/^\//, '') || "store-001-kiosk-1";

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile?machineId=${machineId}`);
      if (!res.ok) {
        console.error(`fetchProfile failed: ${res.status}`);
        return;
      }
      const p = await res.json();
      setProfile(p);
      setTs(Date.now());

      // If softwareRoute changed, load the new version
      if (p.softwareRoute && p.softwareRoute !== prevRoute.current) {
        const assumedDefault = prevRoute.current === null ? "v1" : prevRoute.current;
        if (prevRoute.current !== null || p.softwareRoute !== "v1") {
          console.log(`Route changed from ${assumedDefault} to ${p.softwareRoute}, loading new version...`);
          await loadNewVersion(p.softwareRoute);
          return;
        }
        prevRoute.current = p.softwareRoute;
      }
    } catch (error) {
      console.error("fetchProfile error:", error);
    }
  };

  const loadNewVersion = async (route) => {
    const headers = { "x-software-route": route };
    const res = await fetch(window.location.origin, { headers });  // Fetch root, assuming SPA at /
    if (!res.ok) {
      console.error("Failed to fetch new HTML");
      return;
    }
    let html = await res.text();

    // Parse HTML and preload assets with header
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const baseUrl = window.location.origin;

    const assets = [];
    doc.querySelectorAll('script[src]').forEach((script) => {
      const src = script.getAttribute("src");
      if (src && src.startsWith("/")) {
        assets.push({ element: script, attr: "src", url: baseUrl + src });
      }
    });
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("/")) {
        assets.push({ element: link, attr: "href", url: baseUrl + href });
      }
    });
    // Add more selectors if needed, e.g., for icons: link[rel="icon"], img, etc.

    await Promise.all(
      assets.map(async (asset) => {
        try {
          const aRes = await fetch(asset.url, { headers });
          if (aRes.ok) {
            const blob = await aRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            asset.element.setAttribute(asset.attr, blobUrl);
          } else {
            console.error(`Failed to fetch asset: ${asset.url}`);
          }
        } catch (err) {
          console.error(`Error fetching asset ${asset.url}:`, err);
        }
      })
    );

    // Serialize modified HTML
    html = "<!DOCTYPE html>" + doc.documentElement.outerHTML;

    // Replace current document
    document.open();
    document.write(html);
    document.close();
  };

  useEffect(() => {
    fetchProfile(); // Initial fetch
    const id = setInterval(fetchProfile, 300_000); // Every 5 minutes
    return () => clearInterval(id);
  }, []);

  const routeClass = 'v1-background';

  return (
    <div className={`app ${routeClass}`}>
      <h1>Location-Aware Rollout Demo</h1>
      <p><b>Machine:</b> {machineId}</p>
      <p><b>Assigned Route:</b> {profile?.softwareRoute ?? "(loading...)"}</p>
      <button onClick={fetchProfile}>Refresh Profile</button>
      <p className="last-fetch">
        Last fetch: {new Date(ts).toLocaleTimeString()}
      </p>
    </div>
  );
}