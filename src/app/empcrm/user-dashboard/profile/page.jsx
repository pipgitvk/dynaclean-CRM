"use client";

import { useState, useEffect } from "react";
import { User, Mail, Phone, Calendar, MapPin, Briefcase, GraduationCap, Building, Loader2, Download, ExternalLink, FileText, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function UserProfileView() {
  const [profile, setProfile] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserAndProfile();
  }, []);

  const fetchUserAndProfile = async () => {
    try {
      const userResponse = await fetch("/api/me");
      const userData = await userResponse.json();
      if (userData?.success) setUserData(userData.user);

      const requestUrl = userData?.success && userData?.user?.username
        ? `/api/empcrm/profile?username=${encodeURIComponent(userData.user.username)}`
        : `/api/empcrm/profile`;

      const profileResponse = await fetch(requestUrl);
      const profileData = await profileResponse.json();

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Profile Incomplete</h2>
          <p className="text-gray-600 mb-6">
            Your profile details are missing. Please complete your profile to proceed.
          </p>
          <a href="/empcrm/user-dashboard/profile/edit" className="inline-block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all shadow-md hover:shadow-lg">
            Create Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-end">
          <a href="/empcrm/user-dashboard/profile/edit" className="py-3 px-4 bg-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all shadow-md hover:shadow-lg text-right">
            Edit Profile
          </a>
        </div>
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
          <div className="px-8 pb-8">
            <div className="relative flex flex-col md:flex-row items-center md:items-end -mt-16 mb-6">
              <div className="w-32 h-32 bg-white rounded-full p-2 shadow-lg mb-4 md:mb-0">
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                  {profile.profile_photo ? (
                    <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <User className="w-12 h-12" />
                    </div>
                  )}
                </div>
              </div>
              <div className="md:ml-6 flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900">{profile.full_name}</h1>
                <p className="text-lg text-gray-600 font-medium">{profile.designation || "N/A"}</p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    {profile.work_location || "Location N/A"}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    {profile.employee_code || "ID N/A"}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 uppercase text-xs font-bold tracking-wide">
                    {profile.employment_status || "PROBATION"}
                  </div>
                </div>
              </div>
              <div className="mt-6 md:mt-0">
                {/* Status Badge or Edit Action if needed */}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
              <ContactItem icon={Mail} label="Email" value={profile.email} />
              <ContactItem icon={Phone} label="Mobile" value={profile.contact_mobile} />
              <ContactItem icon={Calendar} label="Joined" value={profile.date_of_joining} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="space-y-8 lg:col-span-2">

            {/* Personal Info */}
            <Section title="Personal Information" icon={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoBox label="Date of Birth" value={profile.date_of_birth} />
                <InfoBox label="Blood Group" value={profile.blood_group} />
                <InfoBox label="Marital Status" value={profile.marital_status} />
                <InfoBox label="Father's Name" value={profile.father_name} />
                <InfoBox label="Mother's Name" value={profile.mother_name} />
                <InfoBox label="Emergency Contact" value={profile.emergency_contact_name} sub={profile.emergency_contact_number} />
              </div>
            </Section>

            {/* Address */}
            <Section title="Address Details" icon={MapPin}>
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Address</span>
                  <p className="text-gray-800">{profile.correspondence_address || "N/A"}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Permanent Address</span>
                  <p className="text-gray-800">{profile.permanent_address || "N/A"}</p>
                </div>
              </div>
            </Section>

            {/* Experience */}
            {profile.experience && profile.experience.length > 0 && (
              <Section title="Work Experience" icon={Briefcase}>
                <div className="space-y-4">
                  {profile.experience.map((exp, i) => (
                    <div key={i} className="flex relative pl-6 pb-6 border-l-2 border-gray-200 last:border-0 last:pb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-500"></div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{exp.designation}</h4>
                        <p className="text-blue-600 font-medium">{exp.company_name}</p>
                        <p className="text-sm text-gray-500 mt-1">{exp.period_from} - {exp.period_to}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
              <Section title="Education" icon={GraduationCap}>
                <div className="space-y-4">
                  {profile.education.map((edu, i) => (
                    <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-gray-900">{edu.exam_name}</h4>
                        <p className="text-sm text-gray-600">{edu.board_university}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{edu.year_of_passing}</p>
                        <p className="text-xs text-blue-600 font-medium">{edu.grade_percentage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Banking */}
            <Section title="Banking Info" icon={Building}>
              <div className="space-y-4">
                <InfoRow label="Bank Name" value={profile.bank_name} />
                <InfoRow label="Account No." value={profile.bank_account_number} />
                <InfoRow label="IFSC Code" value={profile.ifsc_code} />
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                  <InfoRow label="PAN Number" value={profile.pan_number} />
                  <InfoRow label="Aadhaar ID" value={profile.aadhar_number} />
                </div>
              </div>
            </Section>

            {/* Leave Policy */}
            <Section title="Leave Balance" icon={Calendar}>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100">
                  <span className="block text-2xl font-bold text-green-700">{profile.leave_policy?.paid_allowed || 0}</span>
                  <span className="text-xs font-medium text-green-600 uppercase">Paid Leaves</span>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-100">
                  <span className="block text-2xl font-bold text-blue-700">{profile.leave_policy?.sick_allowed || 0}</span>
                  <span className="text-xs font-medium text-blue-600 uppercase">Sick Leaves</span>
                </div>
              </div>
            </Section>

            {/* Documents */}
            <Section title="Documents" icon={FileText}>
              <DocList profile={profile} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-2 border-b border-gray-50">
        <Icon className="w-5 h-5 text-blue-600" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ContactItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value || "N/A"}</p>
      </div>
    </div>
  );
}

function InfoBox({ label, value, sub }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500 uppercase block mb-1">{label}</span>
      <span className="text-sm font-semibold text-gray-900 block">{value || "N/A"}</span>
      {sub && <span className="text-xs text-gray-500 block">{sub}</span>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
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

  // const urls = Array.isArray(profile.joining_form_documents) ? profile.joining_form_documents : [];
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

  if (docItems.length === 0) return <p className="text-sm text-gray-400 italic text-center p-4">No documents uploaded</p>;

  return (
    <ul className="space-y-3">
      {docItems.map((item, idx) => (
        <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100">
          <span className="text-sm font-medium text-gray-700 truncate pr-2" title={item.label}>{item.label}</span>
          <div className="flex gap-2">
            <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="View">
              <ExternalLink className="w-4 h-4" />
            </a>
            <a href={item.url} download className="p-1.5 text-gray-600 hover:bg-gray-200 rounded" title="Download">
              <Download className="w-4 h-4" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
