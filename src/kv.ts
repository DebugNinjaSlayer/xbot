import Cloudflare from "cloudflare";

const client = new Cloudflare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
});

export async function putKv(key: string, value: string, metadata: string) {
  await client.kv.namespaces.values.update(
    process.env.CLOUDFLARE_KV_NAMESPACE_ID as string,
    key,
    {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID as string,
      value,
      metadata,
    }
  );
}

export async function getKv(key: string) {
  const value = await client.kv.namespaces.values.get(
    process.env.CLOUDFLARE_KV_NAMESPACE_ID as string,
    key,
    {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID as string,
    }
  );
  const kvValue = await value.text();
  return JSON.parse(kvValue);
}

export async function listKvWithPrefix(prefix: string) {
  const keys = await client.kv.namespaces.keys.list(
    process.env.CLOUDFLARE_KV_NAMESPACE_ID as string,
    {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID as string,
      prefix,
    }
  );
  return keys.result.map((key) => key.name);
}

export async function getRandomKv() {
  const keys = await client.kv.namespaces.keys.list(
    process.env.CLOUDFLARE_KV_NAMESPACE_ID as string,
    {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID as string,
      limit: 10,
    }
  );
  if (keys.result_info.count === 0) {
    return null;
  }
  const firstKey = keys.result[0];
  const kv = await getKv(firstKey.name);
  return { key: firstKey.name, value: kv.value, metadata: kv.metadata };
}

export async function deleteKv(key: string) {
  await client.kv.namespaces.values.delete(
    process.env.CLOUDFLARE_KV_NAMESPACE_ID as string,
    key,
    {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID as string,
    }
  );
}

// 3dm-1748663904592-368588585-0-80
export function parse3DMKey(key: string): {
  groupId: string;
  chatId: string;
  index: string;
  total: string;
} | null {
  const parts = key.split("-");
  if (parts.length === 5) {
    return {
      groupId: parts[0],
      chatId: parts[1],
      index: parts[2],
      total: parts[3],
    };
  }
  return null;
}

export function parseKey(key: string): {
  chatId: string;
  messageId: string;
  groupId?: string;
} {
  const parts = key.split("-");
  if (parts.length === 2) {
    return {
      chatId: parts[0],
      messageId: parts[1],
    };
  }
  if (parts.length === 3) {
    return {
      chatId: parts[0],
      groupId: parts[1],
      messageId: parts[2],
    };
  }
  throw new Error("Invalid key");
}
