export async function onRequestPost(context) {
  const { request, env } = context;

  // Verify the request has a valid Supabase auth token
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

  const { messages, rhythmData, taskData, profile, locations, projects } = await request.json();

  const now = new Date().toLocaleString("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const systemPrompt = `You are Sesam, a personal assistant embedded in a daily rhythm and task management tool.

CURRENT DATE AND TIME:
- Now: ${now}
- Berlin time

PROFILE (who the user is, stable context):
${profile || "(not yet provided)"}

LOCATIONS (addresses the user moves between):
${locations || "(not yet provided)"}

ONGOING PROJECTS:
${projects || "(not yet provided)"}

CURRENT RHYTHM DATA:
${JSON.stringify(rhythmData, null, 2)}

CURRENT TASK DATA:
${JSON.stringify(taskData, null, 2)}

YOUR ROLE:
- Help prioritize and make decisions about what to do next
- Be honest about load and tradeoffs — don't just validate
- Update data when explicitly asked to
- When you need to make a data change, end your response with a JSON block in this exact format:

\`\`\`update
{
  "action": "complete_subtask",
  "taskId": "t1",
  "subtaskId": "s1a"
}
\`\`\`

Supported actions:
- complete_subtask: { action, taskId, subtaskId }
- set_task_status: { action, taskId, status } (status: "Not started"|"In progress"|"Blocked"|"Done")
- complete_care: { action, day, care } (care: exact care anchor label)
- add_arch_task: { action, phaseId, label, detail, role, deadline } — for PhD archaeology work only
- add_rhythm_task: { action, day, label } — for general daily tasks (meetings, errands)
- add_subtask: { action, taskId, label } — add a subtask to an existing archaeology task
- update_profile: { action, content } — replace the profile text
- update_locations: { action, content } — replace the locations text
- update_projects: { action, content } — replace the projects text

If asked about commute time between two locations, use the get_commute function (you can request a commute calculation by ending your message with):

\`\`\`commute
{ "from": "Home", "to": "MPIWG" }
\`\`\`

The user's app will calculate the real commute time and tell you in the next message. Use the exact location labels from the LOCATIONS section.

When emitting multiple update blocks, write each one separately. The user's app will execute all of them.

Tone: warm, direct, honest. Same register as a trusted colleague who knows you well. Not a cheerleader. Not a therapist.`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error("Anthropic error:", anthropicRes.status, err);
    return new Response(JSON.stringify({ error: err, status: anthropicRes.status }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const data = await anthropicRes.json();
  return new Response(JSON.stringify(data), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}