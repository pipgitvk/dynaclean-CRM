"use client";

import { useState, useEffect } from "react";
import { User, Calendar, MapPin, Briefcase, GraduationCap, Building, Loader2, Download, ExternalLink, FileText, AlertCircle, CheckCircle, Clock, XCircle, Edit, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { labelForReassignKey } from "@/lib/profileReassignFields";

function parseReassignedLabels(submission) {
  if (!submission?.reassigned_fields) return [];
  try {
    const keys =
      typeof submission.reassigned_fields === "string"
        ? JSON.parse(submission.reassigned_fields)
        : submission.reassigned_fields;
    return Array.isArray(keys) ? keys.map((k) => labelForReassignKey(k)) : [];
  } catch {
    return [];
  }
}

export default function UserProfileView() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestSubmission, setLatestSubmission] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    fetchUserAndProfile();
  }, []);

  const fetchUserAndProfile = async () => {
    try {
      const userResponse = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      const userJson = await userResponse.json();

      // Store user role to check privileges
      setUserRole(userJson?.role);

      const requestUrl = userJson?.username
        ? `/api/empcrm/profile?username=${encodeURIComponent(userJson.username)}`
        : `/api/empcrm/profile`;

      const fetchOpts = { credentials: "include", cache: "no-store" };
      const [profileResponse, submissionResponse] = await Promise.all([
        fetch(requestUrl, fetchOpts),
        fetch("/api/empcrm/profile/submissions?mine=latest", fetchOpts),
      ]);

      const profileData = await profileResponse.json();
      const submissionData = await submissionResponse.json();

      if (submissionData.success && submissionData.submissions?.length > 0) {
        setLatestSubmission(submissionData.submissions[0]);
      } else {
        setLatestSubmission(null);
      }

      if (profileData.success && profileData.profile) {
        setProfile(profileData.profile);
      } else if (!profileData.success) {
        toast.error(profileData.error || "Failed to load profile");
      }
    } catch (error) {
      toast.error("Error fetching profile");
    } finally {
      setLoading(false);
    }
  };

  // Check if user is privileged (Admin/HR)
  const isPrivilegedEditor = ["SUPERADMIN", "ADMIN", "HR HEAD", "HR", "HR Executive", "JUNIOR HR EXECUTIVE", "HR RECRUITER"].includes(userRole);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-600 mt-1">View and manage your profile information</p>
            </div>
            <button
              onClick={() => router.push("/empcrm/user-dashboard/profile/edit")}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-md hover:shadow-lg"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !profile ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Profile Not Found</h2>
            <p className="text-gray-600 mb-6">Your profile hasn't been created yet.</p>
            <button
              onClick={() => router.push("/empcrm/user-dashboard/profile/edit")}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Edit className="w-4 h-4" />
              Create Profile
            </button>
          </div>
        ) : (
          <>
            {/* Submission Status Alerts */}
            {(latestSubmission?.status === "reassign" || latestSubmission?.status === "revision_requested") && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-6 h-6 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="font-bold text-lg text-amber-900">HR requested corrections</h2>
                    <p className="text-sm text-amber-800 mt-1">
                      Please update the following items and submit again for approval.
                    </p>
                    {parseReassignedLabels(latestSubmission).length > 0 && (
                      <ul className="mt-3 list-disc pl-5 text-sm text-amber-900 space-y-1">
                        {parseReassignedLabels(latestSubmission).map((label, idx) => (
                          <li key={`${label}-${idx}`}>{label}</li>
                        ))}
                      </ul>
                    )}
                    {latestSubmission.reassignment_note && (
                      <p className="mt-3 text-sm border-t border-amber-200 pt-3">
                        <span className="font-semibold">Note from HR: </span>
                        {latestSubmission.reassignment_note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {latestSubmission?.status === "pending" && (
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:p-6 flex gap-3">
                <Clock className="w-6 h-6 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg text-blue-900">Awaiting HR approval</h2>
                  <p className="text-sm text-blue-800 mt-1">Your profile submission is under review.</p>
                </div>
              </div>
            )}

            {latestSubmission?.status === "pending_hr_docs" && (
              <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 sm:p-6 flex gap-3">
                <Clock className="w-6 h-6 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg text-indigo-900">HR completing documents</h2>
                  <p className="text-sm text-indigo-800 mt-1">Your details are approved. HR is finalizing documents.</p>
                </div>
              </div>
            )}

            {latestSubmission?.status === "approved" && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 sm:p-6 flex gap-3">
                <CheckCircle className="w-6 h-6 shrink-0 text-green-600 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg text-green-900">Profile approved</h2>
                  <p className="text-sm text-green-800 mt-1">Your profile has been published successfully.</p>
                </div>
              </div>
            )}

            {latestSubmission?.status === "rejected" && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 sm:p-6 flex gap-3">
                <XCircle className="w-6 h-6 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg text-red-900">Submission rejected</h2>
                  {latestSubmission.rejection_reason && (
                    <p className="text-sm text-red-800 mt-1">{latestSubmission.rejection_reason}</p>
                  )}
                </div>
              </div>
            )}

            {latestSubmission?.status === "pending_admin" && (
              <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4 sm:p-6 flex gap-3">
                <Clock className="w-6 h-6 shrink-0 text-violet-600 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg text-violet-900">Awaiting final approval</h2>
                  <p className="text-sm text-violet-800 mt-1">Super Admin is reviewing your profile.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Profile Content */}
        {!loading && profile && (
          <div className="space-y-6">
            {/* Personal Information */}
            <Section title="Personal Information" icon={User}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Full Name" value={profile.full_name} />
                  <InfoField label="Email" value={profile.email} />
                  <InfoField label="Contact Mobile" value={profile.contact_mobile} />
                  <InfoField label="Date of Birth" value={profile.date_of_birth} />
                  <InfoField label="Marital Status" value={profile.marital_status} />
                  <InfoField label="Blood Group" value={profile.blood_group} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                  <InfoField label="Father's Name" value={profile.father_name} />
                  <InfoField label="Father's Phone" value={profile.father_phone} />
                  <InfoField label="Mother's Name" value={profile.mother_name} />
                  <InfoField label="Mother's Phone" value={profile.mother_phone} />
                  <InfoField label="Emergency Contact" value={profile.emergency_contact_name} />
                  <InfoField label="Emergency Phone" value={profile.emergency_contact_number} />
                </div>
              </div>
            </Section>

            {/* Employment Information */}
            <Section title="Employment Information" icon={Briefcase}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Employee Code" value={profile.employee_code} />
                  <InfoField label="Designation" value={profile.designation} />
                  <InfoField label="Department" value={profile.department} />
                  <InfoField label="Work Location" value={profile.work_location} />
                  <InfoField label="Employment Status" value={profile.employment_status} />
                  <InfoField label="Date of Joining" value={profile.date_of_joining} />
                  <InfoField label="Probation Period" value={profile.probation_period} />
                  <InfoField label="Reporting Manager" value={profile.reporting_manager} />
                </div>
              </div>
            </Section>

            {/* Address Information */}
            <Section title="Address Information" icon={MapPin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Correspondence Address</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{profile.correspondence_address || "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Permanent Address</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{profile.permanent_address || "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Near Police Station</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{profile.near_police_station || "-"}</p>
                </div>
              </div>
            </Section>

            {/* Banking Information */}
            <Section title="Banking Information" icon={Building}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Bank Name" value={profile.bank_name} />
                <InfoField label="Account Number" value={profile.bank_account_number} />
                <InfoField label="IFSC Code" value={profile.ifsc_code} />
                <InfoField label="Account Type" value={profile.account_type} />
                <InfoField label="PAN Number" value={profile.pan_number} />
                <InfoField label="Aadhaar Number" value={profile.aadhar_number} />
                <InfoField label="PF UAN" value={profile.pf_uan} />
                <InfoField label="ESIC Number" value={profile.esic_number} />
              </div>
            </Section>

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
              <Section title="Education Qualifications" icon={GraduationCap}>
                <div className="space-y-3">
                  {profile.education.map((edu, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Exam/Degree</p>
                          <p className="text-gray-900 font-medium">{edu.exam_name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Board/University</p>
                          <p className="text-gray-900 font-medium">{edu.board_university}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Year of Passing</p>
                          <p className="text-gray-900 font-medium">{edu.year_of_passing}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Grade/Percentage</p>
                          <p className="text-gray-900 font-medium">{edu.grade_percentage}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Work Experience */}
            {profile.experience && profile.experience.length > 0 && (
              <Section title="Work Experience" icon={Briefcase}>
                <div className="space-y-3">
                  {profile.experience.map((exp, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Company</p>
                          <p className="text-gray-900 font-medium">{exp.company_name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Designation</p>
                          <p className="text-gray-900 font-medium">{exp.designation}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Period</p>
                          <p className="text-gray-900 font-medium">{exp.period_from} - {exp.period_to}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Gross Salary (CTC)</p>
                          <p className="text-gray-900 font-medium">{exp.gross_salary_ctc || "-"}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase">Reason for Leaving</p>
                          <p className="text-gray-900 font-medium">{exp.reason_for_leaving}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* References */}
            {profile.references && profile.references.length > 0 && (
              <Section title="References" icon={User}>
                <div className="space-y-3">
                  {profile.references.map((ref, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Name</p>
                          <p className="text-gray-900 font-medium">{ref.name || ref.reference_name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Contact</p>
                          <p className="text-gray-900 font-medium">{ref.contact || ref.reference_mobile}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase">Address</p>
                          <p className="text-gray-900 font-medium">{ref.address || ref.reference_address}</p>
                        </div>
                        {ref.relationship && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Relationship</p>
                            <p className="text-gray-900 font-medium">{ref.relationship}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Documents */}
            <Section title="Documents" icon={FileText}>
              <DocList profile={profile} />
            </Section>

            {/* Leave Policy */}
            <Section title="Leave Policy" icon={Calendar}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs font-semibold text-green-700 uppercase">Paid Leaves Allowed</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{profile.leave_policy?.paid_allowed || 0}</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 uppercase">Sick Leaves Allowed</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{profile.leave_policy?.sick_allowed || 0}</p>
                </div>
              </div>
            </Section>

            {/* Leave Policy Configuration Info - Only for Privileged Editors (Admin/HR) */}
            {isPrivilegedEditor && (
              <Section title="Leave Policy Configuration" icon={Calendar}>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:p-6">
                  <p className="text-sm text-gray-700 mb-4">
                    Configure leave policies for different employment statuses. These settings determine leave eligibility based on probation or permanent status.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="mb-4 pb-4 border-b border-emerald-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Sick Leave</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                            <span className="text-sm text-gray-700">Enabled</span>
                            <span className="font-medium text-gray-900">{profile.leave_policy?.sick_enabled ? "✓ Yes" : "✗ No"}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                            <span className="text-sm text-gray-700">Allowed Days</span>
                            <span className="font-medium text-gray-900">{profile.leave_policy?.sick_allowed || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-4 pb-4 border-b border-emerald-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Paid Leave</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                            <span className="text-sm text-gray-700">Enabled</span>
                            <span className="font-medium text-gray-900">{profile.leave_policy?.paid_enabled ? "✓ Yes" : "✗ No"}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                            <span className="text-sm text-gray-700">Allowed Days</span>
                            <span className="font-medium text-gray-900">{profile.leave_policy?.paid_allowed || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {profile.leave_policy?.accrual_start_date && (
                    <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase">Leave Accrual Start Date</p>
                      <p className="text-gray-900 font-medium mt-1">{profile.leave_policy.accrual_start_date}</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 uppercase mb-2">About Leave Configuration</p>
                  <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
                    <li><span className="font-medium">Probation Period:</span> Limited or no leave benefits during probation</li>
                    <li><span className="font-medium">Permanent Status:</span> Full leave benefits after probation ends</li>
                    <li><span className="font-medium">Sick Leave:</span> Unplanned absence with medical reasons</li>
                    <li><span className="font-medium">Paid Leave:</span> Planned vacation and personal time off</li>
                  </ul>
                </div>
              </Section>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <Icon className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{value || "-"}</p>
    </div>
  );
}

function DocList({ profile }) {
  const docLabels = {
    doc_pan_card: "PAN Card",
    doc_voter_id: "Voter ID",
    doc_aadhaar_card: "Aadhaar Card",
    doc_electricity_bill: "Electricity Bill",
    doc_rent_agreement: "Rent Agreement",
    doc_10th_certificate: "10th Qualification",
    doc_12th_certificate: "12th Qualification",
    doc_degree_diploma: "Diploma / Degree",
    doc_technical_cert: "Technical Cert",
    doc_appt_letter_prev: "Prev. Appointment",
    doc_exp_letter: "Experience Letter",
    doc_relieving_letter: "Relieving Letter",
    doc_salary_slips: "Salary Slips",
    doc_loi_appointment: "LOI Appointment",
    doc_joining_form: "Joining Form",
    doc_emp_verification: "Emp. Verification",
    doc_code_conduct: "Code of Conduct",
    doc_cancelled_cheque: "Cancelled Cheque",
    doc_nda: "NDA",
    doc_company_policy: "Company Policy",
    doc_police_verification: "Police Verification"
  };

  const urls = Array.isArray(profile.joining_form_documents)
    ? profile.joining_form_documents.map(u => decodeURIComponent(u))
    : [];

  const docItems = urls.map(url => {
    const filename = url.split('/').pop();
    const match = filename.match(/^(.*)_\d+(?:\.[^.]+)?$/);
    let label = filename;
    if (match && docLabels[match[1]]) {
      label = docLabels[match[1]];
    } else if (match) {
      label = match[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return { url, label };
  });

  if (docItems.length === 0) {
    return <p className="text-sm text-gray-500 italic">No documents uploaded</p>;
  }

  return (
    <ul className="space-y-2">
      {docItems.map((item, idx) => (
        <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100">
          <span className="text-sm font-medium text-gray-700 truncate pr-2">{item.label}</span>
          <div className="flex gap-2 shrink-0">
            <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="View">
              <ExternalLink className="w-4 h-4" />
            </a>
            <a href={item.url} download className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors" title="Download">
              <Download className="w-4 h-4" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
