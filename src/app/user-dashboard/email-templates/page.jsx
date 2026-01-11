'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './EmailTemplates.module.css';

export default function EmailTemplatesPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [availableVariables, setAvailableVariables] = useState(null);
    const [previewModal, setPreviewModal] = useState(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewSubject, setPreviewSubject] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [sendingTest, setSendingTest] = useState(false);

    const [formData, setFormData] = useState({
        template_name: '',
        template_type: 'INSTALLATION',
        subject_line: '',
        html_content: '',
        is_active: false,
    });

    // Fetch templates
    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const url = filter === 'ALL'
                ? '/api/email-templates?includeVariables=true'
                : `/api/email-templates?type=${filter}&includeVariables=true`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                setTemplates(data.templates);
                if (data.availableVariables) {
                    setAvailableVariables(data.availableVariables);
                }
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            alert('Failed to fetch templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [filter]);

    // Handle create/edit
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = '/api/email-templates';
            const method = editingTemplate ? 'PUT' : 'POST';

            const payload = editingTemplate
                ? { ...formData, template_id: editingTemplate.template_id }
                : formData;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                alert(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
                setShowEditor(false);
                setEditingTemplate(null);
                resetForm();
                fetchTemplates();
            } else {
                alert(data.error || 'Failed to save template');
            }
        } catch (error) {
            console.error('Error saving template:', error);
            alert('Failed to save template');
        }
    };

    // Handle delete
    const handleDelete = async (templateId) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const response = await fetch(`/api/email-templates?template_id=${templateId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                alert('Template deleted successfully');
                fetchTemplates();
            } else {
                alert(data.error || 'Failed to delete template');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('Failed to delete template');
        }
    };

    // Handle activate/deactivate
    const handleToggleActive = async (template) => {
        try {
            const response = await fetch('/api/email-templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: template.template_id,
                    is_active: !template.is_active,
                }),
            });

            const data = await response.json();

            if (data.success) {
                fetchTemplates();
            } else {
                alert(data.error || 'Failed to update template status');
            }
        } catch (error) {
            console.error('Error toggling template status:', error);
            alert('Failed to update template status');
        }
    };

    const handleEdit = (template) => {
        setEditingTemplate(template);
        setFormData({
            template_name: template.template_name,
            template_type: template.template_type,
            subject_line: template.subject_line,
            html_content: template.html_content,
            is_active: template.is_active === 1,
        });
        setShowEditor(true);
    };

    const handlePreview = async (template) => {
        try {
            const response = await fetch('/api/email-templates/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html_content: template.html_content,
                    subject_line: template.subject_line,
                    template_type: template.template_type,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setPreviewModal(template);
                setPreviewHtml(data.processedHtml);
                setPreviewSubject(data.processedSubject);
            } else {
                alert('Failed to generate preview');
            }
        } catch (error) {
            console.error('Error previewing template:', error);
            alert('Failed to generate preview');
        }
    };

    const handleSendTestEmail = async () => {
        if (!testEmail) {
            alert('Please enter an email address');
            return;
        }

        if (!previewModal) return;

        setSendingTest(true);
        try {
            const response = await fetch('/api/email-templates/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html_content: previewModal.html_content,
                    subject_line: previewModal.subject_line,
                    template_type: previewModal.template_type,
                    send_test_email: true,
                    test_email: testEmail,
                }),
            });

            const data = await response.json();
            if (data.success && data.testEmailSent) {
                alert(`Test email sent successfully to ${testEmail}`);
            } else if (data.emailError) {
                alert(`Failed to send test email: ${data.emailError}`);
            } else {
                alert('Failed to send test email');
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            alert('Failed to send test email');
        } finally {
            setSendingTest(false);
        }
    };

    const resetForm = () => {
        setFormData({
            template_name: '',
            template_type: 'INSTALLATION',
            subject_line: '',
            html_content: '',
            is_active: false,
        });
    };

    const handleCancel = () => {
        setShowEditor(false);
        setEditingTemplate(null);
        resetForm();
    };

    const insertVariable = (variable) => {
        const textarea = document.querySelector('textarea[name="html_content"]');
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = formData.html_content;
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newValue = before + `{{${variable}}}` + after;

            setFormData({ ...formData, html_content: newValue });

            // Set cursor position after inserted variable
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
            }, 0);
        }
    };

    if (showEditor) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>{editingTemplate ? 'Edit Email Template' : 'Create Email Template'}</h1>
                    <button onClick={handleCancel} className={styles.cancelButton}>
                        ← Back to Templates
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.editorForm}>
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>Template Name *</label>
                            <input
                                type="text"
                                value={formData.template_name}
                                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Template Type *</label>
                            <select
                                value={formData.template_type}
                                onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
                                required
                                disabled={editingTemplate}
                            >
                                <option value="INSTALLATION">Installation</option>
                                <option value="SERVICE_COMPLETION">Service Completion</option>
                                <option value="COMPLAINT">Complaint/Service Request</option>
                                <option value="DISPATCH">Dispatch Notification</option>
                                <option value="ORDER_APPROVAL">Order Approval</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Subject Line *</label>
                        <input
                            type="text"
                            value={formData.subject_line}
                            onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                            placeholder="e.g., Service Request - {{service_id}}"
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <div className={styles.labelWithHelper}>
                            <label>HTML Content *</label>
                            {availableVariables && (
                                <div className={styles.variableHelper}>
                                    <span>Insert Variable:</span>
                                    <select onChange={(e) => { if (e.target.value) insertVariable(e.target.value); e.target.value = ''; }}>
                                        <option value="">-- Select Variable --</option>
                                        {Object.entries(availableVariables).map(([category, vars]) => (
                                            <optgroup key={category} label={category.replace('_', ' ').toUpperCase()}>
                                                {vars.map(v => (
                                                    <option key={v.name} value={v.name}>{v.name} - {v.description}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <textarea
                            name="html_content"
                            rows={20}
                            value={formData.html_content}
                            onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                            placeholder="Enter HTML content with {{variables}}"
                            required
                            className={styles.htmlEditor}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            Set as Active Template (will deactivate other templates of same type)
                        </label>
                    </div>

                    <div className={styles.formActions}>
                        <button type="submit" className={styles.saveButton}>
                            {editingTemplate ? 'Update Template' : 'Create Template'}
                        </button>
                        <button type="button" onClick={handleCancel} className={styles.cancelButtonSecondary}>
                            Cancel
                        </button>
                    </div>
                </form>

                {formData.html_content && (
                    <div className={styles.previewSection}>
                        <h3>Preview</h3>
                        <div className={styles.preview} dangerouslySetInnerHTML={{ __html: formData.html_content }} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Email Template Management</h1>
                <button onClick={() => setShowEditor(true)} className={styles.createButton}>
                    + Create New Template
                </button>
            </div>

            <div className={styles.filters}>
                <button
                    className={filter === 'ALL' ? styles.activeFilter : ''}
                    onClick={() => setFilter('ALL')}
                >
                    All Templates
                </button>
                <button
                    className={filter === 'INSTALLATION' ? styles.activeFilter : ''}
                    onClick={() => setFilter('INSTALLATION')}
                >
                    Installation
                </button>
                <button
                    className={filter === 'SERVICE_COMPLETION' ? styles.activeFilter : ''}
                    onClick={() => setFilter('SERVICE_COMPLETION')}
                >
                    Service Completion
                </button>
                <button
                    className={filter === 'COMPLAINT' ? styles.activeFilter : ''}
                    onClick={() => setFilter('COMPLAINT')}
                >
                    Complaint
                </button>
                <button
                    className={filter === 'DISPATCH' ? styles.activeFilter : ''}
                    onClick={() => setFilter('DISPATCH')}
                >
                    Dispatch
                </button>
                <button
                    className={filter === 'ORDER_APPROVAL' ? styles.activeFilter : ''}
                    onClick={() => setFilter('ORDER_APPROVAL')}
                >
                    Order Approval
                </button>
            </div>

            {loading ? (
                <div className={styles.loading}>Loading templates...</div>
            ) : (
                <div className={styles.templateList}>
                    {templates.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No templates found. Create your first template to get started.</p>
                        </div>
                    ) : (
                        templates.map((template) => (
                            <div key={template.template_id} className={styles.templateCard}>
                                <div className={styles.templateHeader}>
                                    <div>
                                        <h3>{template.template_name}</h3>
                                        <span className={styles.templateType}>{template.template_type}</span>
                                        {template.is_active === 1 && (
                                            <span className={styles.activeBadge}>Active</span>
                                        )}
                                    </div>
                                    <div className={styles.templateActions}>
                                        <button onClick={() => handlePreview(template)} className={styles.previewButton}>
                                            👁️ Preview
                                        </button>
                                        <button onClick={() => handleEdit(template)} className={styles.editButton}>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(template)}
                                            className={template.is_active === 1 ? styles.deactivateButton : styles.activateButton}
                                        >
                                            {template.is_active === 1 ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button onClick={() => handleDelete(template.template_id)} className={styles.deleteButton}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.templateDetails}>
                                    <p><strong>Subject:</strong> {template.subject_line}</p>
                                    <p><strong>Created:</strong> {new Date(template.created_at).toLocaleString()}</p>
                                    <p><strong>Updated:</strong> {new Date(template.updated_at).toLocaleString()}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Preview Modal */}
            {previewModal && (
                <div className={styles.modal} onClick={() => setPreviewModal(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Template Preview: {previewModal.template_name}</h2>
                            <button onClick={() => setPreviewModal(null)} className={styles.closeButton}>
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.previewInfo}>
                                <p><strong>Template Type:</strong> {previewModal.template_type}</p>
                                <p><strong>Subject:</strong> {previewSubject}</p>
                                <p className={styles.infoNote}>📝 Preview uses sample data to show how the template will look</p>
                            </div>

                            <div className={styles.emailPreview}>
                                <div className={styles.previewHeader}>
                                    <strong>Email Preview:</strong>
                                </div>
                                <div
                                    className={styles.previewContent}
                                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                                />
                            </div>

                            <div className={styles.testEmailSection}>
                                <h3>Send Test Email</h3>
                                <div className={styles.testEmailForm}>
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        placeholder="Enter your email address"
                                        className={styles.testEmailInput}
                                    />
                                    <button
                                        onClick={handleSendTestEmail}
                                        disabled={sendingTest}
                                        className={styles.sendTestButton}
                                    >
                                        {sendingTest ? 'Sending...' : '📧 Send Test Email'}
                                    </button>
                                </div>
                                <p className={styles.testEmailNote}>
                                    A test email with sample data will be sent to the address above.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
