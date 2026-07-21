FROM node:22-bookworm AS toolchain

# Tauri's Linux WebKit shell is the only native dependency in the container.
# macOS and Windows installers are intentionally built by native CI runners.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    file \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup-3.0-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    patchelf \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/opt/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
  | sh -s -- -y --profile minimal \
  && rustup component add rustfmt clippy

WORKDIR /workspace

# Copy manifests first so dependency downloads remain cached across source edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/build.rs ./src-tauri/
COPY src-tauri/tauri.conf.json ./src-tauri/tauri.conf.json
COPY src-tauri/src ./src-tauri/src
RUN cargo fetch --manifest-path src-tauri/Cargo.toml

COPY . .

FROM toolchain AS test
RUN npm test \
  && npm run build \
  && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check \
  && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings \
  && cargo test --manifest-path src-tauri/Cargo.toml

FROM toolchain AS linux-build
RUN npm run desktop:build -- --bundles deb,appimage

FROM toolchain AS development
EXPOSE 1420 1421
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
