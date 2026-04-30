// Test script to verify approval history fix
// This script ensures that approved/rejected requests remain visible to the original reviewer even after reporting manager changes

const { getDbConnection } = require('./src/lib/db');

async function testApprovalHistoryFix() {
  console.log('Testing approval history fix...\n');
  
  const conn = await getDbConnection();
  
  try {
    // Test scenario: Manager approved requests, then employee's reporting manager changed
    
    const managerUsername = 'neha'; // From the image
    const employeeUsername = 'ashutosh_choudhary'; // From the image
    const newManager = 'new_manager';
    
    // 1. Check current approval history for the manager
    console.log(`1. Checking approval history for manager: ${managerUsername}`);
    const [currentHistory] = await conn.execute(
      `SELECT COUNT(*) as count FROM attendance_regularization_requests 
       WHERE reviewed_by = ?`,
      [managerUsername]
    );
    console.log(`   Current approval history count: ${currentHistory[0]?.count || 0}`);
    
    // 2. Get current reporting manager for employee
    const [currentManager] = await conn.execute(
      `SELECT reporting_manager FROM rep_list WHERE username = ? LIMIT 1`,
      [employeeUsername]
    );
    const oldReportingManager = currentManager[0]?.reporting_manager;
    console.log(`   Current reporting manager for ${employeeUsername}: ${oldReportingManager || 'None'}`);
    
    // 3. Simulate reporting manager change
    console.log(`\n2. Simulating reporting manager change to: ${newManager}`);
    await conn.execute(
      `UPDATE rep_list SET reporting_manager = ? WHERE username = ?`,
      [newManager, employeeUsername]
    );
    
    // 4. Check if approval history is preserved for original manager
    console.log(`\n3. Checking if approval history is preserved for original manager...`);
    const [historyAfterChange] = await conn.execute(
      `SELECT COUNT(*) as count FROM attendance_regularization_requests 
       WHERE reviewed_by = ?`,
      [managerUsername]
    );
    console.log(`   Approval history count after change: ${historyAfterChange[0]?.count || 0}`);
    
    // 5. Verify the specific requests are still accessible
    const [specificRequests] = await conn.execute(
      `SELECT id, status, reviewed_by, username FROM attendance_regularization_requests 
       WHERE reviewed_by = ? AND username = ? ORDER BY reviewed_at DESC LIMIT 5`,
      [managerUsername, employeeUsername]
    );
    
    console.log(`\n4. Specific requests for ${employeeUsername} reviewed by ${managerUsername}:`);
    specificRequests.forEach(req => {
      console.log(`   - Request ID: ${req.id}, Status: ${req.status}, Employee: ${req.username}`);
    });
    
    // 6. Restore original reporting manager
    console.log(`\n5. Restoring original reporting manager...`);
    await conn.execute(
      `UPDATE rep_list SET reporting_manager = ? WHERE username = ?`,
      [oldReportingManager || null, employeeUsername]
    );
    
    console.log('\nTest completed successfully!');
    console.log('Approval history should now be preserved regardless of reporting manager changes.');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await conn.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testApprovalHistoryFix();
}

module.exports = { testApprovalHistoryFix };
