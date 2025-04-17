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

async function getKv(key: string) {
  const value = await client.kv.namespaces.values.get(
    process.env.CLOUDFLARE_KV_NAMESPACE_ID as string,
    key,
    {
      account_id: process.env.CLOUDFLARE_ACCOUNT_ID as string,
    }
  );
  return value;
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
  const kvValue = await(await getKv(firstKey.name)).text();
  const json = JSON.parse(kvValue);
  return { key: firstKey.name, value: json.value, metadata: json.metadata };
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
