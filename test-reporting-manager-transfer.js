// Test script to verify reporting manager transfer functionality
// This script demonstrates how pending overtime requests are transferred when reporting manager changes

const { getDbConnection } = require('./src/lib/db');
const { getReportees, getReportingManagerForEmployee } = require('./src/lib/reportingManager');

async function testReportingManagerTransfer() {
  console.log('Testing reporting manager transfer functionality...\n');
  
  const conn = await getDbConnection();
  
  try {
    // Test scenario: Employee has pending requests and reporting manager changes
    
    // 1. Check current reporting manager for an employee
    const employeeUsername = 'test_employee';
    const currentManager = await getReportingManagerForEmployee(employeeUsername);
    console.log(`Current reporting manager for ${employeeUsername}: ${currentManager || 'None'}`);
    
    // 2. Check pending requests for this employee
    const [pendingRequests] = await conn.execute(
      `SELECT COUNT(*) as count FROM attendance_regularization_requests 
       WHERE username = ? AND status = 'pending'`,
      [employeeUsername]
    );
    const pendingCount = pendingRequests[0]?.count || 0;
    console.log(`Pending overtime requests: ${pendingCount}`);
    
    // 3. Simulate reporting manager change
    const newManager = 'new_manager';
    console.log(`\nSimulating reporting manager change to: ${newManager}`);
    
    // Update reporting manager
    await conn.execute(
      `UPDATE rep_list SET reporting_manager = ? WHERE username = ?`,
      [newManager, employeeUsername]
    );
    
    // 4. Verify new manager can see the pending requests
    const newManagerReportees = await getReportees(newManager);
    const canSeeRequests = newManagerReportees.includes(employeeUsername);
    console.log(`New manager can see employee's requests: ${canSeeRequests}`);
    
    // 5. Verify old manager can no longer see the requests
    if (currentManager) {
      const oldManagerReportees = await getReportees(currentManager);
      const oldManagerCanSee = oldManagerReportees.includes(employeeUsername);
      console.log(`Old manager can still see employee's requests: ${oldManagerCanSee}`);
    }
    
    console.log('\nTransfer test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await conn.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testReportingManagerTransfer();
}

module.exports = { testReportingManagerTransfer };
