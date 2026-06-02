# MockServer runs on the JVM, so the image needs BOTH Node (to run this app)
# and a Java runtime (for mockserver-node to spawn `java -jar ...`). Render's
# native Node runtime has no JVM, which is why deploys fail with
# "Error: spawn java ENOENT" — using Docker lets us install a JRE alongside Node.
FROM node:18-bookworm-slim

# Headless JRE is enough to run the MockServer netty jar (needs Java 8+).
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching). devDependencies are kept because
# the app is started with ts-node (see the "start" script), not compiled JS.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Resolve `localhost` to IPv4 (127.0.0.1) first. On Linux/Node 18 `localhost`
# resolves to IPv6 (::1) first, but MockServer's Netty binds IPv4 — so
# mockserver-node's readiness check (which hardcodes host "localhost") connects
# to ::1, gets refused, and reports "MockServer failed to start".
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# Render injects $PORT and the app binds MockServer to it (see config.ts).
CMD ["npm", "start"]
