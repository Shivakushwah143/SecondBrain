type NotionTokenResponse = {
  access_token: string;
  workspace_id: string;
  workspace_name: string;
};

const requireNotionEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
};

export const generateAuthorizationUrl = (): string => {
  const clientId = requireNotionEnv('NOTION_CLIENT_ID');
  const redirectUri = requireNotionEnv('NOTION_REDIRECT_URI');
  const url = new URL('https://api.notion.com/v1/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('owner', 'user');
  url.searchParams.set('redirect_uri', redirectUri);

  return url.toString();
};

export const exchangeCodeForToken = async (code: string): Promise<NotionTokenResponse> => {
  if (!code) {
    throw new Error('Authorization code is required');
  }

  const clientId = requireNotionEnv('NOTION_CLIENT_ID');
  const clientSecret = requireNotionEnv('NOTION_CLIENT_SECRET');
  const redirectUri = requireNotionEnv('NOTION_REDIRECT_URI');

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const detail = data && typeof data === 'object' ? JSON.stringify(data) : 'Unknown error';
    throw new Error(`Notion token exchange failed: ${response.status} ${detail}`);
  }

  const { access_token, workspace_id, workspace_name } = data as NotionTokenResponse;

  if (!access_token || !workspace_id || !workspace_name) {
    throw new Error('Invalid token response from Notion');
  }

  return { access_token, workspace_id, workspace_name };
};
