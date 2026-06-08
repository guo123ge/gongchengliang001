const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const password = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

function log(message) {
  console.log(`【冒烟测试】${message}`);
}

function fail(message) {
  throw new Error(message);
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function expectStatus(label, resp, expected) {
  if (resp.status !== expected) {
    const body = await resp.text().catch(() => "");
    fail(`${label} 期望状态 ${expected}，实际 ${resp.status}${body ? `，响应：${body}` : ""}`);
  }
  log(`${label}：通过（HTTP ${resp.status}）`);
}

function readCookie(resp) {
  const raw = resp.headers.get("set-cookie");
  if (!raw) fail("登录响应未返回会话 Cookie");
  return raw.split(";")[0];
}

async function main() {
  log(`目标服务：${baseUrl}`);
  if (!password) {
    fail("缺少 ADMIN_PASSWORD 或 SMOKE_ADMIN_PASSWORD，无法执行登录态接口测试");
  }

  await expectStatus("未登录访问项目列表应被拒绝", await request("/api/projects"), 401);

  const meBefore = await request("/api/auth/me", { cache: "no-store" });
  await expectStatus("登录前认证状态接口", meBefore, 200);

  const loginResp = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  await expectStatus("管理员登录", loginResp, 200);
  const cookie = readCookie(loginResp);

  const authHeaders = { Cookie: cookie, "Content-Type": "application/json" };
  const projectId = `smoke_${Date.now()}`;
  const projectPayload = {
    id: projectId,
    name: "冒烟测试项目",
    components: [],
    blueprint: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    componentCount: 0,
  };

  await expectStatus("保存项目", await request(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify(projectPayload),
  }), 200);

  await expectStatus("读取项目", await request(`/api/projects/${encodeURIComponent(projectId)}`, {
    headers: { Cookie: cookie },
  }), 200);

  const form = new FormData();
  form.append("projectId", projectId);
  form.append("file", new Blob(["smoke api file"], { type: "text/plain" }), "smoke.txt");
  const uploadResp = await request("/api/uploads", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  await expectStatus("上传文件", uploadResp, 200);
  const uploadData = await uploadResp.json();
  if (!uploadData?.file?.id || !uploadData?.file?.url) fail("上传响应缺少 file.id 或 file.url");

  await expectStatus("读取上传文件", await request(uploadData.file.url, {
    headers: { Cookie: cookie },
  }), 200);

  await expectStatus("OCR 缺少 fileId 应返回 400", await request("/api/ocr/jobs", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  }), 400);

  await expectStatus("删除测试项目", await request(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  }), 200);

  log("全部接口冒烟测试通过");
}

main().catch((error) => {
  console.error(`【冒烟测试】失败：${error.message}`);
  process.exit(1);
});
