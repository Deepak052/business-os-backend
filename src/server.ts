import { app } from './app';
import { env } from './config/env';
import { startInvitationSweeper } from './jobs/invitation-sweeper';

const PORT = env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
  startInvitationSweeper();
});
