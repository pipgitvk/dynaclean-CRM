const { getDbConnection } = require('./db');

/**
 * Resolve the next assignee from meta_form_assignments table based on form-specific priority
 * Uses round-robin logic with priority ordering for a specific form
 */
async function resolveAssigneeFromFormAssignments(formId) {
  const conn = await getDbConnection();

  try {
    // Get all users for this form ordered by priority (lower = higher priority)
    const [assignmentRows] = await conn.execute(
      `SELECT username, priority, max_leads
       FROM meta_form_assignments
       WHERE form_id = ? AND is_active = 1
       ORDER BY priority ASC, username ASC`,
      [formId]
    );

    if (assignmentRows.length === 0) {
      return null; // No form-specific assignments found
    }

    // Check current lead counts for each user for this form
    const usernames = assignmentRows.map(row => row.username);
    const placeholders = usernames.map(() => '?').join(',');

    const [leadCounts] = await conn.execute(
      `SELECT assigned_to, COUNT(*) as lead_count
       FROM meta_leads
       WHERE assigned_to IN (${placeholders})
       AND form_id = ?
       AND DATE(created_at) = CURDATE()
       GROUP BY assigned_to`,
      [...usernames, formId]
    );

    // Create a map of current lead counts
    const leadCountMap = {};
    leadCounts.forEach(row => {
      leadCountMap[row.assigned_to] = row.lead_count;
    });

    // Find the user with the lowest lead count within their max_leads limit
    let selectedUser = null;
    let minLeads = Infinity;

    for (const user of assignmentRows) {
      const currentLeads = leadCountMap[user.username] || 0;
      const maxLeads = user.max_leads || 99999;

      if (currentLeads < maxLeads && currentLeads < minLeads) {
        minLeads = currentLeads;
        selectedUser = user.username;
      }
    }

    // If all users are at max_leads, pick the one with the lowest count anyway (fallback)
    if (!selectedUser) {
      for (const user of assignmentRows) {
        const currentLeads = leadCountMap[user.username] || 0;
        if (currentLeads < minLeads) {
          minLeads = currentLeads;
          selectedUser = user.username;
        }
      }
    }

    if (!selectedUser) {
      selectedUser = assignmentRows[0].username; // Ultimate fallback
    }

    return selectedUser;
  } catch (error) {
    console.error('Error resolving assignee from form assignments:', error);
    throw error;
  }
}

/**
 * Resolve the next assignee from lead_distribution table based on priority
 * Uses round-robin logic with priority ordering (fallback when no form-specific assignments)
 */
async function resolveAssigneeFromLeadDistribution() {
  const conn = await getDbConnection();

  try {
    // Get all users from lead_distribution ordered by priority (lower = higher priority)
    const [distributionRows] = await conn.execute(
      `SELECT username, priority, max_leads
       FROM lead_distribution
       ORDER BY priority ASC, username ASC`
    );

    if (distributionRows.length === 0) {
      throw new Error('No users found in lead_distribution table');
    }

    // Check current lead counts for each user
    const usernames = distributionRows.map(row => row.username);
    const placeholders = usernames.map(() => '?').join(',');

    const [leadCounts] = await conn.execute(
      `SELECT assigned_to, COUNT(*) as lead_count
       FROM customers
       WHERE assigned_to IN (${placeholders})
       AND DATE(date_created) = CURDATE()
       GROUP BY assigned_to`,
      usernames
    );

    // Create a map of current lead counts
    const leadCountMap = {};
    leadCounts.forEach(row => {
      leadCountMap[row.assigned_to] = row.lead_count;
    });

    // Find the user with the lowest lead count within their max_leads limit
    let selectedUser = null;
    let minLeads = Infinity;

    for (const user of distributionRows) {
      const currentLeads = leadCountMap[user.username] || 0;
      const maxLeads = user.max_leads || 99999;

      if (currentLeads < maxLeads && currentLeads < minLeads) {
        minLeads = currentLeads;
        selectedUser = user.username;
      }
    }

    // If all users are at max_leads, pick the one with the lowest count anyway (fallback)
    if (!selectedUser) {
      for (const user of distributionRows) {
        const currentLeads = leadCountMap[user.username] || 0;
        if (currentLeads < minLeads) {
          minLeads = currentLeads;
          selectedUser = user.username;
        }
      }
    }

    if (!selectedUser) {
      selectedUser = distributionRows[0].username; // Ultimate fallback
    }

    return selectedUser;
  } catch (error) {
    console.error('Error resolving assignee from lead_distribution:', error);
    throw error;
  }
}

module.exports = {
  resolveAssigneeFromFormAssignments,
  resolveAssigneeFromLeadDistribution
};
