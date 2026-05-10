import { spawn } from 'child_process';

const getPrefix = (name: string) => `[aibroker:${name}]`;
const postgresContainerName = 'postgres';
const aiBrokerContainerName = 'aibroker';

function logClose(code: number) {
  if (code === -1)
    console.error(`Process was terminated by user.`);
  else if (code > 0)
    console.error(`Process exited with error code ${code}`);
  else
    console.log(`Process closed and was successful.`);
}

function run(command: string, args: string[], done?: (code: number) => any) {

  const script = spawn(command, args, {});

  script.stdout.on('data', (data) => {
    console.log(`${getPrefix('data')}: ${data}`);
  });

  script.stderr.on('data', (data) => {
    console.error(`${getPrefix('err')}: ${data}`);
  });

  script.on('close', (code) => {
    const result = code === null ? -1 : code;
    if (done) return done(result);
    logClose(result)
  });
}

export function postgresRun() {
  const args = `run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -e PGDATA=/var/lib/postgresql/data/pgdata -v postgres:/var/lib/postgresql/data postgres`.split(' ');
  run('docker', args);
}

export function postgresStop() {
  run('docker', ['stop', postgresContainerName]);
}

export function postgresRemove() {
  run('docker', ['rm', '-f', postgresContainerName], (code) => {
    if (code !== 0)
      return logClose(code);
    run('docker', ['volume', 'prune', '-f']);
  });
}

export function aiBrokerRun() {
  const args = `run -d --name aibroker -e PORT=4000 -e DATABASE_CONNECTION_URL=postgresql://postgres:postgres@host.docker.internal:5432/aibroker -e MASTER_KEY_SECRET=change-to-long-string -e SESSION_SECRET=change-to-long-string -p 4000:4000 aibroker`.split(' ');
  run('docker', args);
}

export function aiBrokerStop() {
  run('docker', ['stop', aiBrokerContainerName]);
}

export function aiBrokerRemove() {
  run('docker', ['rm', '-f', aiBrokerContainerName], (code) => {
    if (code !== 0)
      return logClose(code);
    run('docker', ['volume', 'prune', '-f']);
  });
}

export function dockerPruneVolumes() {
  run('docker', 'volume prune -f'.split(' '));
}

// -e POSTGRES_PASSWORD = postgres \
// -e PGDATA = /var/lib / postgresql / data / pgdata \
// -v postgres: /var/lib / postgresql / data \
// -d postgres