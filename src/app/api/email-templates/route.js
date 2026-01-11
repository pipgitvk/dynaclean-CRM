import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getAvailableVariables } from '@/lib/template-utils';

// GET - Fetch templates (all or filtered by type)
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');
        const includeVariables = searchParams.get('includeVariables') === 'true';

        const conn = await getDbConnection();

        let query = 'SELECT * FROM email_templates';
        const params = [];

        if (type) {
            query += ' WHERE template_type = ?';
            params.push(type);
        }

        query += ' ORDER BY template_type, is_active DESC, created_at DESC';

        const [templates] = await conn.execute(query, params);

        const response = {
            success: true,
            templates,
        };

        // Include available variables if requested
        if (includeVariables) {
            response.availableVariables = getAvailableVariables();
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching email templates:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch templates' },
            { status: 500 }
        );
    }
}

// POST - Create new template
export async function POST(req) {
    try {
        const body = await req.json();
        const { template_name, template_type, subject_line, html_content, is_active } = body;

        // Validation
        if (!template_name || !template_type || !subject_line || !html_content) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const validTypes = ['INSTALLATION', 'SERVICE_COMPLETION', 'COMPLAINT', 'DISPATCH', 'ORDER_APPROVAL'];
        if (!validTypes.includes(template_type)) {
            return NextResponse.json(
                { success: false, error: 'Invalid template type' },
                { status: 400 }
            );
        }

        const conn = await getDbConnection();

        // If setting as active, deactivate other templates of same type
        if (is_active) {
            await conn.execute(
                'UPDATE email_templates SET is_active = 0 WHERE template_type = ?',
                [template_type]
            );
        }

        // Insert new template
        const [result] = await conn.execute(
            `INSERT INTO email_templates (template_name, template_type, subject_line, html_content, is_active)
       VALUES (?, ?, ?, ?, ?)`,
            [template_name, template_type, subject_line, html_content, is_active ? 1 : 0]
        );

        return NextResponse.json({
            success: true,
            message: 'Template created successfully',
            template_id: result.insertId,
        });
    } catch (error) {
        console.error('Error creating email template:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create template' },
            { status: 500 }
        );
    }
}

// PUT - Update existing template
export async function PUT(req) {
    try {
        const body = await req.json();
        const { template_id, template_name, subject_line, html_content, is_active } = body;

        if (!template_id) {
            return NextResponse.json(
                { success: false, error: 'Template ID is required' },
                { status: 400 }
            );
        }

        const conn = await getDbConnection();

        // Fetch template type
        const [[template]] = await conn.execute(
            'SELECT template_type FROM email_templates WHERE template_id = ?',
            [template_id]
        );

        if (!template) {
            return NextResponse.json(
                { success: false, error: 'Template not found' },
                { status: 404 }
            );
        }

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (template_name !== undefined) {
            updates.push('template_name = ?');
            params.push(template_name);
        }
        if (subject_line !== undefined) {
            updates.push('subject_line = ?');
            params.push(subject_line);
        }
        if (html_content !== undefined) {
            updates.push('html_content = ?');
            params.push(html_content);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No fields to update' },
                { status: 400 }
            );
        }

        // If setting as active, deactivate ALL templates of same type first (including this one)
        // Then update this template to active
        if (is_active) {
            // First, set ALL templates of this type to inactive
            await conn.execute(
                'UPDATE email_templates SET is_active = 0 WHERE template_type = ?',
                [template.template_type]
            );
        }

        params.push(template_id);

        await conn.execute(
            `UPDATE email_templates SET ${updates.join(', ')} WHERE template_id = ?`,
            params
        );

        return NextResponse.json({
            success: true,
            message: 'Template updated successfully',
        });
    } catch (error) {
        console.error('Error updating email template:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update template' },
            { status: 500 }
        );
    }
}

// DELETE - Delete template
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const template_id = searchParams.get('template_id');

        if (!template_id) {
            return NextResponse.json(
                { success: false, error: 'Template ID is required' },
                { status: 400 }
            );
        }

        const conn = await getDbConnection();

        const [result] = await conn.execute(
            'DELETE FROM email_templates WHERE template_id = ?',
            [template_id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, error: 'Template not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Template deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting email template:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete template' },
            { status: 500 }
        );
    }
}
