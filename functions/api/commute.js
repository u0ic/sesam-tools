export async function onRequestPost(context) {
  const { request, env } = context;

  // Verify auth
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { origin, destination, mode } = await request.json();
  if (!origin || !destination) {
    return new Response(JSON.stringify({ error: "Missing origin or destination" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const travelMode = mode || "transit";
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("mode", travelMode);
  url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);
  if (travelMode === "transit") {
    url.searchParams.set("departure_time", "now");
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    return new Response(JSON.stringify({ error: data.status, details: data }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return new Response(JSON.stringify({ error: element?.status || "No route found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    duration: element.duration.text,
    distance: element.distance.text,
    duration_seconds: element.duration.value,
    mode: travelMode,
  }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
