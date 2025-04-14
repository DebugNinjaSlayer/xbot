import dotenv from "dotenv";
import express, { Request, Response } from "express";
import session from "express-session";
import TwitterApi from "twitter-api-v2";
import { getAuthUrl } from "./x";

declare module "express-session" {
  interface SessionData {
    oauth_token_secret?: string;
  }
}

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "you should change this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      maxAge: 3600000,
    },
  })
);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World");
});

app.get("/hello", async (req: Request, res: Response) => {
  const authLink = await getAuthUrl(
    new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY as string,
      appSecret: process.env.TWITTER_APP_SECRET as string,
    })
  );
  req.session.oauth_token_secret = authLink.oauth_token_secret;
  res.redirect(authLink.url);
});

app.get("/callback", (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { oauth_token_secret } = req.session;

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    res.status(400).send("You denied the app or your session expired!");
    return;
  }

  const tmpClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY as string,
    appSecret: process.env.TWITTER_APP_SECRET as string,
    accessToken: oauth_token as string,
    accessSecret: oauth_token_secret as string,
  });

  tmpClient
    .login(oauth_verifier as string)
    .then(({ client: loggedClient, accessToken, accessSecret }) => {
      console.log("accessToken");
      console.log(accessToken);
      console.log("accessSecret");
      console.log(accessSecret);
    })
    .catch(() => res.status(403).send("Invalid verifier or access tokens!"));
  res.send(
    "Check your console for the access token and secret, set them to Environment Variables and restart the server"
  );
});

export default app;
