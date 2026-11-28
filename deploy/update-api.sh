#!/usr/bin/env bash
set -euo pipefail
ROOT=/data/704-class-system
ENV_FILE="$HOME/.config/704-api/mail-0194.env"
IMAGE=announcement704/704-api:0.41.1
TEST=api704-v0411-test
test -f "$ENV_FILE"
test -d "$ROOT/uploads"
if ! grep -q '^FIREBASE_API_KEY=.' "$ENV_FILE"; then
  # Migrate the existing public Web key without printing it or copying other environment values.
  printf '\n' >> "$ENV_FILE"
  docker exec api704 node --input-type=module -e '
    import {firebaseConfig} from "./firebase-config.mjs";
    const key=firebaseConfig.apiKey;
    if(typeof key!=="string"||!/^AIza[A-Za-z0-9_-]+$/.test(key))process.exit(1);
    process.stdout.write("FIREBASE_API_KEY="+key+"\n");
  ' >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi
git -C "$ROOT/source" pull --ff-only origin main
docker build -t "$IMAGE" "$ROOT/source/server"
docker create --name "$TEST" --network 1panel-network --restart no \
  -p 127.0.0.1:7041:7040 --env-file "$ENV_FILE" \
  -v "$ROOT/uploads:/data/chat-files" "$IMAGE"
trap 'docker rm -f "$TEST" >/dev/null 2>&1 || true' EXIT
docker start "$TEST"
ready() {
  for attempt in {1..30}; do
    if curl --max-time 3 -fsS "http://127.0.0.1:$1/health" >/dev/null &&
      curl --max-time 3 -fsS "http://127.0.0.1:$1/public/auth-config" | grep -q '"firebase":{"enabled":true,"bindingRequired":true,"providers":\["google","github","microsoft"\]'; then return 0; fi
    sleep 2
  done
  return 1
}
today_ready() {
  docker exec "$1" node --input-type=module -e '
    import {db} from "./db.mjs";
    import {loadToday} from "./today.mjs";
    import {createClassroom} from "./classroom.mjs";
    try {
      for (const role of ["admin", "teacher", "assistant", "student"]) {
        await loadToday(db, {id: "00000000-0000-4000-8000-000000000001", role, permissions: {homework: true, records: true, publish: true, reports: true}});
        const user={id:"00000000-0000-4000-8000-000000000001",role,permissions:{collections:true,board_reply:true}};
        for(const resource of ["board","collections","presence","honors"]){
          await createClassroom(db).routes({path:"/school/"+resource,method:"GET",user,query:new URLSearchParams(),readBody:async()=>{throw Error("Unexpected write");},send:()=>{}});
        }
      }
      await db.query("select last_read_at from school_members limit 0");
      await db.query("select uploads_pending from school_messages limit 0");
      console.log("CLASSROOM_OK: board, collections, presence and chat schema passed");
      console.log("TODAY_OK: admin, teacher, assistant and student queries passed");
    } catch (error) {
      console.error("TODAY_FAILED", error.code || "UNKNOWN", error.message);
      process.exitCode = 1;
    } finally {
      await db.end();
    }
  '
}
ready 7041
today_ready "$TEST"
docker exec "$TEST" sh -c 'test -w /data/chat-files'
docker rm -f "$TEST"
BACKUP="api704-pre-v0411-$(date +%Y%m%d-%H%M%S)"
docker stop api704
docker rename api704 "$BACKUP"
rollback() {
  docker rm -f api704 >/dev/null 2>&1 || true
  docker rename "$BACKUP" api704
  docker start api704
  echo 'DEPLOY_FAILED: previous API restored'
}
if docker create --name api704 --network 1panel-network --restart unless-stopped \
  -p 127.0.0.1:7040:7040 --env-file "$ENV_FILE" \
  -v "$ROOT/uploads:/data/chat-files" "$IMAGE" && docker start api704 && ready 7040 && today_ready api704; then
  echo "DEPLOY_OK v0.41.1; BACKUP=$BACKUP"
else
  rollback
  exit 1
fi
