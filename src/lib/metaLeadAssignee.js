const {
  resolveAssigneeFromFormAssignments,
  resolveAssigneeFromLeadDistribution,
} = require('./leadDistributionResolver');

async function resolveMetaLeadAssignee(formId, credentialEmployeeName = null) {
  if (credentialEmployeeName) {
    return {
      assignedTo: credentialEmployeeName,
      employeeName: credentialEmployeeName,
    };
  }

  let assignedTo = await resolveAssigneeFromFormAssignments(formId);

  if (!assignedTo) {
    assignedTo = await resolveAssigneeFromLeadDistribution();
  }

  if (!assignedTo) {
    throw new Error('No assignee available for Meta lead');
  }

  return {
    assignedTo,
    employeeName: assignedTo,
  };
}

module.exports = {
  resolveMetaLeadAssignee,
};
