import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const ganttBoards=sqliteTable('gantt_boards',{
 id:text('id').primaryKey(),name:text('name').notNull(),nameKey:text('name_key').notNull().unique(),
 startWeek:text('start_week').notNull(),endWeek:text('end_week').notNull(),firstWeekNumber:integer('first_week_number').notNull().default(1),
 createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),
});
export const boardState = sqliteTable('board_state', {
  id: text('id').primaryKey(),
  projects: text('projects').notNull(),
  tasks: text('tasks').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const loginAttempts=sqliteTable('login_attempts',{
 id:text('id').primaryKey(),count:integer('count').notNull().default(0),window:integer('window').notNull(),
});
export const managerTurns=sqliteTable('manager_turns',{
 boardId:text('board_id').notNull().default('team'),
 id:text('id').primaryKey(),author:text('author').notNull(),message:text('message').notNull(),
 reply:text('reply').notNull().default(''),drafts:text('drafts').notNull().default('[]'),
 notificationDrafts:text('notification_drafts').notNull().default('[]'),
 status:text('status').notNull().default('processing'),confirmationId:text('confirmation_id'),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('manager_author_created').on(t.author,t.createdAt)]);
export const projectLogs=sqliteTable('project_logs',{
 id:text('id').primaryKey(),projectId:text('project_id').notNull(),projectTitle:text('project_title').notNull(),
 author:text('author').notNull(),workDone:text('work_done').notNull(),status:text('status'),
 nextSteps:text('next_steps'),blockers:text('blockers'),createdAt:text('created_at').notNull(),
 turnId:text('turn_id').notNull(),
},t=>[index('project_log_date').on(t.projectId,t.createdAt)]);
export const projectMemory=sqliteTable('project_memory',{
 projectId:text('project_id').primaryKey(),status:text('status'),nextSteps:text('next_steps'),
 blockers:text('blockers'),updatedAt:text('updated_at').notNull(),author:text('author').notNull(),
 lastLogId:text('last_log_id').notNull(),
});
export const notifications=sqliteTable('notifications',{
 boardId:text('board_id').notNull().default('team'),
 id:text('id').primaryKey(),recipient:text('recipient').notNull(),sender:text('sender').notNull(),
 projectId:text('project_id').notNull(),projectTitle:text('project_title').notNull(),taskId:text('task_id'),taskTitle:text('task_title'),
 deliverable:text('deliverable').notNull(),reason:text('reason').notNull(),turnId:text('turn_id').notNull(),
 activeKey:text('active_key').unique(),createdAt:text('created_at').notNull(),readAt:text('read_at'),
 resolvedAt:text('resolved_at'),resolutionNote:text('resolution_note'),senderReadAt:text('sender_read_at'),
},t=>[index('notification_recipient_date').on(t.recipient,t.createdAt),index('notification_sender_date').on(t.sender,t.createdAt)]);

export const assignedOwner=sqliteTable('assigned_owner',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),createdAt:text('created_at').notNull(),
});
export const assignedJobs=sqliteTable('assigned_jobs',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),title:text('title').notNull(),assignee:text('assignee').notNull(),
 brief:text('brief').notNull().default(''),deadline:text('deadline').notNull(),completedAt:text('completed_at'),
 revision:integer('revision').notNull().default(0),reminderVersion:integer('reminder_version').notNull().default(0),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('assigned_owner_deadline').on(t.ownerId,t.deadline)]);
export const assignedBriefs=sqliteTable('assigned_briefs',{
 id:text('id').primaryKey(),jobId:text('job_id').notNull(),ownerId:text('owner_id').notNull(),objectKey:text('object_key').notNull(),
 filename:text('filename').notNull(),size:integer('size').notNull(),contentType:text('content_type').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('assigned_brief_job').on(t.ownerId,t.jobId)]);
export const assignedReminders=sqliteTable('assigned_reminders',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),jobId:text('job_id').notNull(),reminderVersion:integer('reminder_version').notNull(),
 kind:text('kind').notNull(),reminderDate:text('reminder_date').notNull(),createdAt:text('created_at').notNull(),readAt:text('read_at'),
},t=>[index('assigned_reminder_owner').on(t.ownerId,t.createdAt)]);
export const assignedTurns=sqliteTable('assigned_turns',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),message:text('message').notNull(),reply:text('reply').notNull().default(''),
 proposals:text('proposals').notNull().default('[]'),status:text('status').notNull().default('processing'),confirmationId:text('confirmation_id'),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('assigned_turn_owner').on(t.ownerId,t.createdAt)]);
export const assignedReminderRuns=sqliteTable('assigned_reminder_runs',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),ranAt:text('ran_at').notNull(),createdCount:integer('created_count').notNull(),
});

export const chinaTables=sqliteTable('china_tables',{
 id:text('id').primaryKey(),name:text('name').notNull(),revision:integer('revision').notNull().default(0),
 createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const chinaTasks=sqliteTable('china_tasks',{
 id:text('id').primaryKey(),tableId:text('table_id').notNull().references(()=>chinaTables.id),title:text('title').notNull(),
 progress:integer('progress').notNull().default(0),priority:text('priority').notNull().default('Medium'),
 status:text('status').notNull().default('Not started'),assignee:text('assignee'),notes:text('notes').notNull().default(''),deadline:text('deadline'),
 revision:integer('revision').notNull().default(0),archivedAt:text('archived_at'),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('china_tasks_table_archive').on(t.tableId,t.archivedAt)]);
export const chinaMessages=sqliteTable('china_messages',{
 id:text('id').primaryKey(),taskId:text('task_id').notNull().references(()=>chinaTasks.id),author:text('author').notNull(),
 kind:text('kind').notNull().default('team'),body:text('body').notNull(),status:text('status').notNull().default('ready'),
 replyTo:text('reply_to').unique(),requestDavid:integer('request_david').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('china_messages_task_date').on(t.taskId,t.createdAt,t.id)]);
