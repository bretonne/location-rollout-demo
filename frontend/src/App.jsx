import { useEffect, useState, useRef } from "react";
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [ts, setTs] = useState(Date.now());
  const prevRoute = useRef(null);
  const isLoadingNewVersion = useRef(false);

  const machineId = window.location.pathname.replace(/^\//, '') || "store-001-kiosk-1";

  const fetchProfile = async () => {
    // Prevent fetch during version loading
    if (isLoadingNewVersion.current) {
      console.log("Skipping fetch during version load");
      return;
    }

    try {
      console.log(`Fetching profile for ${machineId}, current route: ${prevRoute.current}`);
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
        const current = prevRoute.current || 'v1';
        console.log(`Route change: ${current} -> ${p.softwareRoute}`);

        // Only reload if we have a previous route set (not first load)
        if (prevRoute.current !== null || p.softwareRoute !== "v1") {
          console.log(`Loading new version: ${p.softwareRoute}`);
          await loadNewVersion(p.softwareRoute);
          return;
        }

        // First time - just set the route
        prevRoute.current = p.softwareRoute;
        console.log(`Set initial route: ${prevRoute.current}`);
      }
    } catch (error) {
      console.error("fetchProfile error:", error);
    }
  };

  const loadNewVersion = async (targetRoute) => {
    if (isLoadingNewVersion.current) {
      console.log("Already loading version, skipping");
      return;
    }

    isLoadingNewVersion.current = true;
    console.log(`Loading new version for route: ${targetRoute}`);

    try {
      // Store the target route so the new load knows what it should be
      sessionStorage.setItem('targetRoute', targetRoute);

      const headers = { "x-software-route": targetRoute };

      // Fetch the root with the header to get the correct HTML from the right deployment
      const res = await fetch(window.location.origin, { headers });

      if (!res.ok) {
        console.error(`Failed to fetch new HTML: ${res.status}`);
        isLoadingNewVersion.current = false;
        return;
      }

      let html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const baseUrl = window.location.origin;

      // Collect all assets that need the header
      const assets = [];

      // Scripts
      doc.querySelectorAll('script[src]').forEach((script) => {
        const src = script.getAttribute("src");
        if (src && src.startsWith("/")) {
          assets.push({ element: script, attr: "src", url: baseUrl + src });
        }
      });

      // Stylesheets
      doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
        const href = link.getAttribute("href");
        if (href && href.startsWith("/")) {
          assets.push({ element: link, attr: "href", url: baseUrl + href });
        }
      });

      // Images (for completeness)
      doc.querySelectorAll('img[src]').forEach((img) => {
        const src = img.getAttribute("src");
        if (src && src.startsWith("/")) {
          assets.push({ element: img, attr: "src", url: baseUrl + src });
        }
      });

      // Load all assets with the header
      await Promise.all(
        assets.map(async (asset) => {
          try {
            const aRes = await fetch(asset.url, { headers });
            if (aRes.ok) {
              const blob = await aRes.blob();
              const blobUrl = URL.createObjectURL(blob);
              asset.element.setAttribute(asset.attr, blobUrl);
              // Clean up blob URL when page unloads
              window.addEventListener('beforeunload', () => URL.revokeObjectURL(blobUrl), { once: true });
            } else {
              console.warn(`Failed to fetch asset: ${asset.url} (${aRes.status})`);
              // Keep original URL if fetch fails
            }
          } catch (err) {
            console.warn(`Error fetching asset ${asset.url}:`, err);
          }
        })
      );

      // Update the route in the document before replacing
      // This ensures the new React app starts with the correct prevRoute
      const scriptTag = doc.createElement('script');
      scriptTag.textContent = `
        window.__INITIAL_ROUTE__ = '${targetRoute}';
        sessionStorage.removeItem('targetRoute');
      `;
      doc.head.appendChild(scriptTag);

      // Serialize and replace document
      html = "<!DOCTYPE html>" + doc.documentElement.outerHTML;

      document.open();
      document.write(html);
      document.close();

      console.log(`Successfully loaded version: ${targetRoute}`);

    } catch (error) {
      console.error("Error loading new version:", error);
      isLoadingNewVersion.current = false;
    }
  };

  useEffect(() => {
    // Check for target route from previous reload
    const targetRoute = sessionStorage.getItem('targetRoute') || window.__INITIAL_ROUTE__;
    if (targetRoute && !prevRoute.current) {
      console.log(`Restoring target route: ${targetRoute}`);
      prevRoute.current = targetRoute;
      if (window.__INITIAL_ROUTE__) {
        delete window.__INITIAL_ROUTE__;
      }
    }

    fetchProfile(); // Initial fetch
    const id = setInterval(fetchProfile, 300_000); // Every 5 minutes
    return () => clearInterval(id);
  }, []);

  const routeClass = 'v2-background';

  return (
    <div className={`app ${routeClass}`}>
      <h1>Location-Aware Rollout Demo</h1>
      <p><b>Machine:</b> {machineId}</p>
      <p><b>Assigned Route:</b> {profile?.softwareRoute ?? "(loading...)"}</p>
      <p><b>Current Version:</b> {prevRoute.current ?? "(initializing...)"}</p>
      <p><b>Loading:</b> {isLoadingNewVersion.current ? "Yes" : "No"}</p>
      <button onClick={fetchProfile} disabled={isLoadingNewVersion.current}>
        Refresh Profile
      </button>
      <p className="last-fetch">
        Last fetch: {new Date(ts).toLocaleTimeString()}
      </p>
    </div>
  );
}