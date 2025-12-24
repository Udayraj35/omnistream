import { authService } from '../services/auth.service.ts';
import { prisma } from '../db.ts';

export const authController = {
  async getAuthConfigStatus(req: any, res: any) {
    res.json({
      youtube: !!(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('your_')),
      twitch: !!(process.env.TWITCH_CLIENT_ID && !process.env.TWITCH_CLIENT_ID.includes('your_')),
      facebook: !!(process.env.FACEBOOK_CLIENT_ID && !process.env.FACEBOOK_CLIENT_ID.includes('your_')),
      x: !!(process.env.X_CLIENT_ID && !process.env.X_CLIENT_ID.includes('your_'))
    });
  },

  async getLoginUrl(req: any, res: any) {
    const { platform } = req.params;
    try {
      const result = await authService.getOAuthUrl(platform);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to get auth URL' });
    }
  },

  async callback(req: any, res: any) {
    const { platform } = req.params;
    const { code, state } = req.query;

    try {
      const account = await authService.handleCallback(platform, code as string, state as string);
      const html = `
        <!DOCTYPE html><html><head><title>Auth Success</title></head><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'AUTH_SUCCESS', account: ${JSON.stringify(account)} }, '*');
              window.close();
            } else { document.body.innerHTML = 'Authentication successful. You can close this window.'; }
          </script>
        </body></html>`;
      res.send(html);
    } catch (error) {
      console.error(error);
      res.status(500).send('Authentication failed');
    }
  },

  async getUserAccounts(req: any, res: any) {
    const userId = 'default-dev-user-id';
    try {
      const accounts = await authService.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  },

  async removeAccount(req: any, res: any) {
    const { id } = req.params;
    try {
      if ((prisma as any).account.delete) {
        await prisma.account.delete({ where: { id } });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete failed", error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  },

  async createAccount(req: any, res: any) {
    const { platform, name, rtmpUrl, streamKey } = req.body;
    const userId = 'default-dev-user-id';

    try {
      if (platform === 'custom_rtmp') {
        const account = await authService.createCustomAccount(userId, { name, url: rtmpUrl, key: streamKey });
        res.json(account);
      } else {
        res.status(400).json({ error: 'Only custom_rtmp supported for manual creation' });
      }
    } catch (error) {
      console.error("Create account failed", error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
};