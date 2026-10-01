const net = require("net");
const { execFileSync } = require("child_process");

const listenPort = 8081;

function getWslIp() {
  return execFileSync("wsl.exe", ["hostname", "-I"], { encoding: "utf8" })
    .replace(/\0/g, "")
    .trim()
    .split(/\s+/)[0];
}

let wslIp = getWslIp();

const server = net.createServer((client) => {
  const upstream = net.createConnection({ host: wslIp, port: 8080 });
  upstream.once("connect", () => {
    client.pipe(upstream);
    upstream.pipe(client);
  });
  upstream.once("error", () => {
    try { wslIp = getWslIp(); } catch {}
    client.destroy();
  });
  client.once("error", () => upstream.destroy());
  client.once("close", () => upstream.destroy());
});

server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(`phpMyAdmin TCP relay: http://127.0.0.1:${listenPort}/phpmyadmin/ -> ${wslIp}:8080`);
});
