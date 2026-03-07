import ftp from "basic-ftp";

export async function withFtp(config, fn) {
  const client = new ftp.Client(30_000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.host,
      port: config.port ?? 21,
      user: config.user,
      password: config.password,
      secure: false,
    });

    // Force binary mode
    await client.send("TYPE I");

    return await fn(client);
  } finally {
    client.close();
  }
}
