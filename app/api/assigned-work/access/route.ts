import {assignedOwner,privateReply,privateError} from '../../../../lib/assigned-auth';
import {readAssignedReminders,runAssignedReminders} from '../../../../lib/assigned-store';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await assignedOwner();await runAssignedReminders(user.userId);const reminders=await readAssignedReminders(user.userId);return privateReply({allowed:true,name:user.name,canViewAll:user.canViewAll,unread:reminders.filter(r=>!r.readAt).length});}catch(e){return privateError(e);}}
