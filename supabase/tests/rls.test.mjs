// Runs supabase/schema.sql twice (idempotence) in an in-memory Postgres (PGlite)
// with minimal stubs of Supabase's auth/storage schemas, then checks the
// permissions and triggers through realistic scenarios.   npm run test:db
import { PGlite } from "@electric-sql/pglite"
import fs from "fs"

const db = new PGlite()
const schema = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8")
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
`)
for (const run of [1, 2]) {
  try { await db.exec(schema) } catch (e) { console.log(`SQL ERROR (run ${run}):`, e.message); process.exit(1) }
}
await db.exec(`grant usage on schema public, auth, storage to authenticated, anon;
grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon;
grant select, insert, delete on storage.objects to authenticated;`)
console.log("schema OK (ran twice)")

const id = (n) => `00000000-0000-0000-0000-00000000000${n}`
const ADMIN = id(1), B = id(2), C = id(3), D = id(4)   // admin(intl) · Berk(paris) · Cem(lyon) · Deniz(intl)
const users = [
  [ADMIN, "secretaire@youthstation.org", { first_name: "Ayşe", last_name: "Admin", station_id: "intl" }],
  [B, "berk@x.org", { first_name: "Berk", last_name: "Paris", station_id: "paris", hometown: "Adana" }],
  [C, "cem@x.org", { first_name: "Cem", last_name: "Lyon", station_id: "lyon" }],
  [D, "deniz@x.org", { first_name: "Deniz", last_name: "Intl", station_id: "intl" }],
]
users.push([id(5), "misafir@x.org", { first_name: "Mert", last_name: "Misafir", guest: true, station_id: "lyon" }])
for (const [uid, mail, meta] of users) await db.query(`insert into auth.users values ($1, $2, $3)`, [uid, mail, JSON.stringify(meta)])

const as = async (uid, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`)
  try { return await db.query(sql, params) } finally { await db.exec("reset role") }
}
const denied = async (uid, sql) => { try { return (await as(uid, sql)).rows.length === 0 } catch { return true } }
const fails = async (uid, sql) => { try { await as(uid, sql); return false } catch { return true } }
const q = async (sql) => (await db.query(sql)).rows
let failed = 0
const check = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) failed++ }

// ── accounts ────────────────────────────────────────────────────────────────
let r = await q(`select id, app_role, status from profiles order by id`)
check("VIP e-mail waits for approval, with the role ready", r[0].app_role === "admin" && r[0].status === "pending")
check("unapproved VIP has no admin power", (await as(ADMIN, `select public.is_admin() as a`)).rows[0].a === false)
await db.exec(`select set_config('ysa.trusted', 'on', false); update profiles set status = 'active' where id = '${ADMIN}'; select set_config('ysa.trusted', 'off', false);`)
check("other sign-ups wait for approval", r.slice(1).every((p) => p.status === "pending" && p.app_role === "member"))
check("pending member sees only himself", (await as(B, `select id from profiles`)).rows.length === 1)
await as(B, `update profiles set status = 'active', app_role = 'admin', points = 999 where id = '${B}'`)
r = await q(`select status, app_role, points from profiles where id = '${B}'`)
check("member cannot self-approve, self-promote or edit points", r[0].status === "pending" && r[0].app_role === "member" && r[0].points === 0)
for (const u of [B, C, D]) await as(ADMIN, `update profiles set status = 'active' where id = '${u}'`)
check("new member notifies the others", (await q(`select count(*)::int n from notifications where type = 'member' and user_id = '${B}'`))[0].n >= 2)
await as(B, `update profiles set station_id = 'lyon', position = 'Başkan' where id = '${B}'`)
check("active member cannot change station / position", (await q(`select station_id, position from profiles where id = '${B}'`))[0].station_id === "paris")
await as(D, `update profiles set position = 'Sekreter' where id = '${B}'`)
check("Uluslararası Büro can assign a position", (await q(`select position from profiles where id = '${B}'`))[0].position === "Sekreter")

r = await q(`select station_id, position from profiles where id = '${id(5)}'`)
check("Misafir giriş: no station, position Misafir", r[0].station_id === null && r[0].position === "Misafir")
await db.exec(`update profiles set status = 'active' where id = '${id(5)}'`)
check("guest cannot create a station task", await fails(id(5), `insert into tasks (title, station_id, created_by) values ('x', 'paris', '${id(5)}')`))
check("guest sees events open to all stations", (await as(id(5), `select id from events where station_id is null`)).rows.length >= 0)

// ── feed & pinning ─────────────────────────────────────────────────────────
check("member cannot create a pinned post", await fails(B, `insert into posts (author_id, content, pinned) values ('${B}', 'x', true)`))
check("clients cannot forge welcome posts", await fails(B, `insert into posts (author_id, kind, content) values ('${B}', 'welcome', 'x')`))
const post = (await as(B, `insert into posts (author_id, station_id, content) values ('${B}', 'paris', 'Merhaba') returning id`)).rows[0].id
await as(B, `update posts set pinned = true where id = '${post}'`)
check("author cannot pin his own post", (await q(`select pinned from posts where id = '${post}'`))[0].pinned === false)
await as(D, `update posts set pinned = true where id = '${post}'`)
check("Uluslararası Büro pins a post", (await q(`select pinned from posts where id = '${post}'`))[0].pinned === true)
await as(C, `insert into post_comments (post_id, author_id, content) values ('${post}', '${C}', 'güzel')`)
check("comment earns +2 points", (await q(`select points from profiles where id = '${C}'`))[0].points === 2)
check("comment notifies the author", (await q(`select 1 from notifications where type = 'comment' and user_id = '${B}'`)).length === 1)
check("clients cannot write notifications", await fails(B, `insert into notifications (user_id, type, title) values ('${C}', 'task', 'fake')`))

await as(C, `insert into post_likes (post_id, user_id) values ('${post}', '${C}')`)
check("like earns +1 point", (await q(`select points from profiles where id = '${C}'`))[0].points === 3)
await as(C, `delete from post_likes where post_id = '${post}' and user_id = '${C}'`)
await as(C, `insert into post_likes (post_id, user_id) values ('${post}', '${C}')`)
check("like / unlike cannot farm points", (await q(`select points from profiles where id = '${C}'`))[0].points === 3)
await as(ADMIN, `update profiles set app_role = 'admin' where id = '${B}'`)
check("admin role reserved to VIP e-mails", (await q(`select app_role from profiles where id = '${B}'`))[0].app_role === "member")
const other = (await as(C, `insert into posts (author_id, content) values ('${C}', 'kural dışı') returning id`)).rows[0].id
check("member cannot delete someone else's post", (await as(B, `delete from posts where id = '${other}' returning id`)).rows.length === 0)
check("Uluslararası Büro deletes any post", (await as(D, `delete from posts where id = '${other}' returning id`)).rows.length === 1)

// ── private events ─────────────────────────────────────────────────────────
check("member cannot create an event for another station", await fails(B, `insert into events (title, starts_at, station_id, created_by) values ('x', now(), 'lyon', '${B}')`))
const ev = (await as(C, `insert into events (title, starts_at, station_id, is_private, created_by) values ('Lyon özel', now() + interval '1 day', 'lyon', true, '${C}') returning id`)).rows[0].id
check("🔒 private event hidden from other stations", (await as(B, `select id from events where id = '${ev}'`)).rows.length === 0)
r = (await as(B, `select * from public.locked_events()`)).rows
check("🔒 other stations only get a locked slot (no title)", r.length === 1 && r[0].id === ev && !("title" in r[0]))
check("deleted post took its points back, event creation earns +5", (await q(`select points from profiles where id = '${C}'`))[0].points === 8)
check("🔒 private event visible to Uluslararası Büro", (await as(D, `select id from events where id = '${ev}'`)).rows.length === 1)
check("event notifies only its station", (await q(`select user_id from notifications where type = 'event'`)).length === 0)
await as(D, `insert into events (title, starts_at, station_id, created_by) values ('Paris kahvaltı', now(), 'paris', '${D}')`)
r = await q(`select user_id from notifications where type = 'event'`)
check("station event notifies station members", r.length === 1 && r[0].user_id === B)

// ── tasks ───────────────────────────────────────────────────────────────────
const task = (await as(B, `insert into tasks (title, station_id, assign_all, created_by) values ('Afiş', 'paris', true, '${B}') returning id`)).rows[0].id
check("other station cannot see the task", (await as(C, `select id from tasks where id = '${task}'`)).rows.length === 0)
check("Uluslararası Büro sees every task", (await as(D, `select id from tasks where id = '${task}'`)).rows.length === 1)
check("member cannot create a task for another station", await fails(B, `insert into tasks (title, station_id, created_by) values ('x', 'lyon', '${B}')`))
const lyonTask = (await as(D, `insert into tasks (title, station_id, assignee_id, created_by) values ('Rapor', 'lyon', '${C}', '${D}') returning id`)).rows[0].id
await as(D, `insert into tasks (title, station_id, assignee_id, created_by) values ('Paris dışı', 'lyon', '${B}', '${D}')`)
check("tasks of another station stay hidden even if assigned to me", (await as(B, `select id from tasks where station_id = 'lyon'`)).rows.length === 0)
await as(C, `update tasks set status = 'done' where id = '${lyonTask}'`)
check("completed görev earns +10", (await q(`select points from profiles where id = '${C}'`))[0].points === 18)
await as(C, `update tasks set status = 'todo' where id = '${lyonTask}'`)
await as(C, `update tasks set status = 'done' where id = '${lyonTask}'`)
check("reopening a görev does not farm points", (await q(`select points from profiles where id = '${C}'`))[0].points === 18)
check("görev notifies the assignee", (await q(`select 1 from notifications where type = 'task' and user_id = '${C}'`)).length === 1)

// ── messaging, mentions, points ────────────────────────────────────────────
const conv = (await as(B, `insert into conversations (type, name, created_by) values ('group', 'Ekip', '${B}') returning id`)).rows[0].id
await as(B, `insert into conversation_members (conversation_id, user_id, is_admin) values ('${conv}', '${B}', true), ('${conv}', '${C}', false), ('${conv}', '${D}', false)`)
check("outsider cannot read the group", (await as(ADMIN, `select id from conversations where id = '${conv}'`)).rows.length === 0)
await as(D, `update conversation_members set muted = true where conversation_id = '${conv}' and user_id = '${D}'`)
const m1 = (await as(B, `insert into messages (conversation_id, sender_id, content, mentions) values ('${conv}', '${B}', '@Cem Lyon @Deniz Intl selam', '{${C},${D}}') returning id`)).rows[0].id
await as(B, `insert into messages (conversation_id, sender_id, content) values ('${conv}', '${B}', 'ikinci')`)
r = await q(`select type, count, title from notifications where user_id = '${C}' and type in ('message', 'mention') order by type`)
check("messages grouped in one bell entry (count = 2)", r.find((n) => n.type === "message")?.count === 2)
check("@mention creates its own notification", r.some((n) => n.type === "mention"))
r = await q(`select type from notifications where user_id = '${D}' and type in ('message', 'mention')`)
check("muted member: no message alert but still the @mention", r.length === 1 && r[0].type === "mention")
check("points: post +3 and 2 messages +2", (await q(`select points from profiles where id = '${B}'`))[0].points === 5)
r = (await as(C, `select * from public.my_conversations()`)).rows[0]
check("unread + mentioned flags", Number(r.unread) === 2 && r.mentioned === true)
await as(C, `select public.mark_read('${conv}')`)
r = (await as(C, `select * from public.my_conversations()`)).rows[0]
check("mark_read clears unread and the bell entry", Number(r.unread) === 0 && (await q(`select read_at from notifications where user_id = '${C}' and type = 'message'`))[0].read_at !== null)
check("📌 group admin (not intl) cannot pin", await fails(B, `select public.pin_message('${conv}', '${m1}')`))
await as(B, `update conversations set pinned_message_id = '${m1}' where id = '${conv}'`)
check("📌 direct update by non-intl is ignored", (await q(`select pinned_message_id from conversations where id = '${conv}'`))[0].pinned_message_id === null)
await as(D, `select public.pin_message('${conv}', '${m1}')`)
check("📌 Uluslararası Büro pins a message", (await q(`select pinned_message_id, pinned_by from conversations where id = '${conv}'`))[0].pinned_by === D)
const dm1 = (await as(B, `select public.open_dm('${C}') as id`)).rows[0].id
check("open_dm is idempotent", dm1 === (await as(C, `select public.open_dm('${B}') as id`)).rows[0].id)

// ── chat poll ──────────────────────────────────────────────────────────────
const pm = (await as(B, `insert into messages (conversation_id, sender_id, kind, content) values ('${conv}', '${B}', 'poll', 'Tarih?') returning id`)).rows[0].id
const poll = (await as(B, `insert into polls (message_id, question) values ('${pm}', 'Tarih?') returning id`)).rows[0].id
const opt = (await as(B, `insert into poll_options (poll_id, label) values ('${poll}', 'Cuma') returning id`)).rows[0].id
await as(C, `insert into poll_votes (poll_id, option_id, user_id) values ('${poll}', '${opt}', '${C}')`)
check("members vote in chat polls", (await q(`select count(*)::int n from poll_votes`))[0].n === 1)
check("outsider cannot see the chat poll", (await as(ADMIN, `select id from polls where id = '${poll}'`)).rows.length === 0)

// ── message likes ───────────────────────────────────────────────────────────
check("a member can like a message", (await as(C, `insert into message_likes (message_id, user_id) values ('${m1}', '${C}')`), (await q(`select count(*)::int n from message_likes where message_id = '${m1}'`))[0].n === 1))
check("an outsider cannot like a message", await fails(ADMIN, `insert into message_likes (message_id, user_id) values ('${m1}', '${ADMIN}')`))
check("members see who liked", (await as(B, `select user_id from message_likes where message_id = '${m1}'`)).rows.length === 1)
check("an outsider cannot read the likes", (await as(ADMIN, `select user_id from message_likes where message_id = '${m1}'`)).rows.length === 0)
check("you cannot unlike someone else's like", (await as(B, `delete from message_likes where message_id = '${m1}' and user_id = '${C}'`), (await q(`select count(*)::int n from message_likes where message_id = '${m1}' and user_id = '${C}'`))[0].n === 1))

// ── files (PDF) ────────────────────────────────────────────────────────────
await db.exec(`insert into storage.objects (bucket_id, name, owner) values ('files', '${conv}/plan.pdf', '${B}'), ('files', 'feed/rapor.pdf', '${B}')`)
check("chat PDF readable by conversation members", (await as(C, `select name from storage.objects where name like '${conv}%'`)).rows.length === 1)
check("chat PDF hidden from outsiders", (await as(ADMIN, `select name from storage.objects where name like '${conv}%'`)).rows.length === 0)
check("feed PDF readable by every active member", (await as(ADMIN, `select name from storage.objects where name like 'feed/%'`)).rows.length === 1)
check("cannot upload into someone else's chat", await fails(ADMIN, `insert into storage.objects (bucket_id, name) values ('files', '${conv}/x.pdf')`))

// ── ranking ────────────────────────────────────────────────────────────────
r = (await as(C, `select * from public.member_rank('${B}')`)).rows[0]
check("member_rank works", Number(r.total) === 5 && Number(r.rank) >= 1)
const before = (await q(`select id, points from profiles order by id`)).map((x) => x.points).join()
await db.exec(`select public.recompute_points()`)
check("recompute_points matches the live counters", (await q(`select id, points from profiles order by id`)).map((x) => x.points).join() === before)

// ── SIGNALEMENTS (reports → admins = président & secrétaire) ────────────────
// conv is a group of B/C/D; ADMIN (intl admin) is an outsider.
check("admin cannot read a conversation with no report", (await as(ADMIN, `select id from messages where conversation_id = '${conv}'`)).rows.length === 0)
const rep = (await as(C, `select public.report_content('message', '${m1}', '${conv}', 'uygunsuz')`)).rows[0].report_content
check("any member can file a report", !!rep)
check("reporting a message notifies the admins", (await q(`select count(*)::int n from notifications where type = 'report' and user_id = '${ADMIN}'`))[0].n === 1)
check("reporter sees only their own report", (await as(C, `select id from reports`)).rows.length === 1 && (await as(B, `select id from reports`)).rows.length === 0)
check("admin sees every report", (await as(ADMIN, `select id from reports`)).rows.length === 1)
check("open report lets the admin read the reported conversation", (await as(ADMIN, `select id from messages where conversation_id = '${conv}'`)).rows.length === 3)
check("a normal member cannot resolve a report", await fails(C, `select public.resolve_report('${rep}', 'resolved')`))
await as(ADMIN, `select public.resolve_report('${rep}', 'resolved')`)
check("resolving the report re-locks the conversation", (await as(ADMIN, `select id from messages where conversation_id = '${conv}'`)).rows.length === 0)

// ── SOFT DELETE (deleted accounts keep their name) ──────────────────────────
await as(ADMIN, `update profiles set status = 'deleted', position = null where id = '${B}'`)
check("admin can soft-delete an account", (await q(`select status from profiles where id = '${B}'`))[0].status === "deleted")
check("a deleted member's name still resolves for others", (await as(C, `select full_name from profiles where id = '${B}'`)).rows.length === 1)

// ── notifications capped at 5 ────────────────────────────────────────────────
await db.query(`delete from notifications where user_id = '${D}'`)
for (let i = 1; i <= 7; i++) await db.query(`insert into notifications (user_id, type, title, created_at) values ('${D}', 'task', 'n${i}', now() + ($1 || ' seconds')::interval)`, [i])
const capped = await q(`select count(*)::int n from notifications where user_id = '${D}'`)
check("a member keeps at most 5 notifications", capped[0].n === 5)
const kept = await q(`select title from notifications where user_id = '${D}' order by created_at`)
check("the 5 kept are the most recent (oldest pushed out)", kept.map((r) => r.title).join() === "n3,n4,n5,n6,n7")

for (let i = 1; i <= 7; i++) await db.query(`insert into notifications (user_id, type, title, group_key) values ('${D}', 'message', 'chat${i}', 'conv:${i}')`)
const afterChat = await q(`select title from notifications where user_id = '${D}' and type <> 'message' order by created_at`)
check("chat messages never push others out of the bell", afterChat.map((r) => r.title).join() === "n3,n4,n5,n6,n7")
check("chat entries are kept for push", (await q(`select id from notifications where user_id = '${D}' and type = 'message'`)).length === 7)

// ── MEDIA BUCKET LISTING ─────────────────────────────────────────────────────
await db.exec(`grant select on storage.objects to anon`)
await q(`insert into storage.objects (bucket_id, name) values ('media', 'x/photo.jpg')`)
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
let anonRows = 1
try { anonRows = (await db.query(`select name from storage.objects where bucket_id = 'media'`)).rows.length } catch { anonRows = 0 } finally { await db.exec("reset role") }
check("a visitor cannot list the media bucket", anonRows === 0)
check("an active member can list it", (await as(C, `select name from storage.objects where bucket_id = 'media'`)).rows.length === 1)

// ── BLOCKING (App Store guideline 1.2) ──────────────────────────────────────
{
const E = id(6), F = id(7)
for (const [uid, mail, first] of [[E, "ece@x.org", "Ece"], [F, "fatih@x.org", "Fatih"]]) {
  await db.query(`insert into auth.users values ($1, $2, $3)`, [uid, mail, JSON.stringify({ first_name: first, last_name: "Blok", station_id: "lyon" })])
  await as(ADMIN, `update profiles set status = 'active' where id = '${uid}'`)
}
const dm = (await as(E, `select public.open_dm('${F}') as id`)).rows[0].id
await as(F, `insert into messages (conversation_id, sender_id, content) values ('${dm}', '${F}', 'avant blocage')`)
const post = (await q(`insert into posts (author_id, content) values ('${F}', 'post de Fatih') returning id`))[0].id
await q(`insert into post_comments (post_id, author_id, content) values ('${post}', '${F}', 'commentaire de Fatih')`)
check("before blocking, the post is visible", (await as(E, `select id from posts where id = '${post}'`)).rows.length === 1)
check("a member cannot block on behalf of someone else", await fails(E, `insert into user_blocks (blocker_id, blocked_id) values ('${F}', '${E}')`))
await as(E, `insert into user_blocks (blocker_id, blocked_id) values ('${E}', '${F}')`)
check("the blocked person's post disappears", (await as(E, `select id from posts where id = '${post}'`)).rows.length === 0)
check("the blocked person's comment disappears", (await as(E, `select id from post_comments where post_id = '${post}'`)).rows.length === 0)
check("the blocked person's messages disappear", (await as(E, `select id from messages where conversation_id = '${dm}'`)).rows.length === 0)
check("the conversation list no longer previews them", (await as(E, `select last_content, unread from public.my_conversations() where id = '${dm}'`)).rows.every((c) => c.last_content === null && Number(c.unread) === 0))
check("the post stays visible to everyone else", (await as(C, `select id from posts where id = '${post}'`)).rows.length === 1)
check("the blocked person cannot write to the blocker", await fails(F, `insert into messages (conversation_id, sender_id, content) values ('${dm}', '${F}', 'encore')`))
check("the blocker cannot write either", await fails(E, `insert into messages (conversation_id, sender_id, content) values ('${dm}', '${E}', 'salut')`))
check("the blocked person cannot reopen a DM", await fails(F, `select public.open_dm('${E}')`))
check("the blocked person cannot see who blocked them", (await as(F, `select * from user_blocks`)).rows.length === 0)
await q(`insert into notifications (user_id, type, title, actor_id) values ('${E}', 'comment', 'bloquee', '${F}')`)
check("no notification comes from a blocked person", (await q(`select id from notifications where user_id = '${E}' and title = 'bloquee'`)).length === 0)
await as(E, `delete from user_blocks where blocked_id = '${F}'`)
check("unblocking brings the content back", (await as(E, `select id from posts where id = '${post}'`)).rows.length === 1)
check("unblocking reopens messages", !(await fails(F, `insert into messages (conversation_id, sender_id, content) values ('${dm}', '${F}', 'de retour')`)))
check("device tokens are closed to members", await denied(E, `select * from device_tokens`))
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED")
process.exit(failed ? 1 : 0)
