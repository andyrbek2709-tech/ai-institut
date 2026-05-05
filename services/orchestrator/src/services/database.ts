import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'pino';
import { DatabaseError } from '../utils/errors';
import { TaskStatus } from './state-machine';

export class Database {
  private client: SupabaseClient;
  private logger: Logger;

  constructor(supabaseUrl: string, supabaseServiceKey: string, logger: Logger) {
    this.client = createClient(supabaseUrl, supabaseServiceKey);
    this.logger = logger;
  }

  async getTask(taskId: string) {
    try {
      const { data, error } = await this.client
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) {
        throw new DatabaseError(`Failed to fetch task: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error({ error, taskId }, 'Database error fetching task');
      throw error;
    }
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    try {
      const { data, error } = await this.client
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to update task status: ${error.message}`);
      }

      this.logger.info({ taskId, newStatus }, 'Task status updated');
      return data;
    } catch (error) {
      this.logger.error({ error, taskId, newStatus }, 'Database error updating task status');
      throw error;
    }
  }

  async unblockDependentTasks(parentTaskId: string) {
    try {
      // Get all dependent tasks
      const { data: dependencies, error: depError } = await this.client
        .from('task_dependencies')
        .select('dependent_task_id')
        .eq('parent_task_id', parentTaskId)
        .eq('resolved_at', null);

      if (depError) {
        throw new DatabaseError(`Failed to fetch dependencies: ${depError.message}`);
      }

      if (!dependencies || dependencies.length === 0) {
        return [];
      }

      const dependentIds = dependencies.map(d => d.dependent_task_id);

      // For each dependent task, check if all its blockers are resolved
      const updated = [];
      for (const depId of dependentIds) {
        const hasUnresolvedBlockers = await this.checkUnresolvedBlockers(depId);
        if (!hasUnresolvedBlockers) {
          const result = await this.updateTaskStatus(depId, TaskStatus.IN_PROGRESS);
          updated.push(result);

          // Mark dependency as resolved
          await this.client
            .from('task_dependencies')
            .update({ resolved_at: new Date().toISOString() })
            .eq('dependent_task_id', depId)
            .eq('parent_task_id', parentTaskId);
        }
      }

      return updated;
    } catch (error) {
      this.logger.error({ error, parentTaskId }, 'Error unblocking dependent tasks');
      throw error;
    }
  }

  private async checkUnresolvedBlockers(taskId: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('task_dependencies')
        .select('id')
        .eq('dependent_task_id', taskId)
        .is('resolved_at', null)
        .limit(1);

      if (error) {
        throw new DatabaseError(`Failed to check blockers: ${error.message}`);
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      this.logger.error({ error, taskId }, 'Error checking unresolved blockers');
      throw error;
    }
  }

  async createNotification(notification: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    task_id?: string;
    read: boolean;
    channels: string[];
  }) {
    try {
      const { data, error } = await this.client
        .from('notifications')
        .insert({
          ...notification,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to create notification: ${error.message}`);
      }

      this.logger.info({ userId: notification.user_id, type: notification.type }, 'Notification created');
      return data;
    } catch (error) {
      this.logger.error({ error, notification }, 'Error creating notification');
      throw error;
    }
  }

  async createTaskHistory(record: {
    task_id: string;
    event_type: string;
    old_value?: string;
    new_value?: string;
    user_id?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { data, error } = await this.client
        .from('task_history')
        .insert({
          ...record,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to create task history: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error({ error, record }, 'Error creating task history');
      throw error;
    }
  }

  async getProjectLead(projectId: string) {
    try {
      const { data, error } = await this.client
        .from('projects')
        .select('lead_id')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new DatabaseError(`Failed to fetch project lead: ${error.message}`);
      }

      return data?.lead_id;
    } catch (error) {
      this.logger.error({ error, projectId }, 'Error fetching project lead');
      throw error;
    }
  }

  async getGip(projectId: string) {
    try {
      const { data, error } = await this.client
        .from('projects')
        .select('gip_id')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new DatabaseError(`Failed to fetch GIP: ${error.message}`);
      }

      return data?.gip_id;
    } catch (error) {
      this.logger.error({ error, projectId }, 'Error fetching GIP');
      throw error;
    }
  }

  async getUser(userId: string) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new DatabaseError(`Failed to fetch user: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error({ error, userId }, 'Error fetching user');
      throw error;
    }
  }

  async updateTaskDeadlineColor(taskId: string, color: 'green' | 'yellow' | 'red' | 'black') {
    try {
      const { data, error } = await this.client
        .from('tasks')
        .update({ deadline_color: color })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to update deadline color: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error({ error, taskId, color }, 'Error updating deadline color');
      throw error;
    }
  }
}
