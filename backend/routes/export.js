const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, verifyRole } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// ── Shared: build achievement query for faculty's students ──────────────────
async function buildFacultyQuery(pool, facultyId, filters = {}) {
  const assignedCheck = await pool.query(
    `SELECT COUNT(*) FROM users WHERE faculty_id = $1 AND role = 'student'`,
    [facultyId]
  );
  const hasAssigned = parseInt(assignedCheck.rows[0].count) > 0;

  let facultyFilter, params;
  if (hasAssigned) {
    facultyFilter = `u.faculty_id = $1`;
    params = [facultyId];
  } else {
    facultyFilter = `u.role = 'student'`;
    params = [];
  }

  let query = `
    SELECT
      a.id,
      u.name            AS student_name,
      u.roll_number,
      u.department,
      u.year_of_study,
      u.batch,
      a.title,
      a.event_name,
      a.event_type,
      a.level,
      a.place_held,
      a.result,
      a.position,
      a.start_date,
      a.end_date,
      a.duration_days,
      a.certificate_url,
      a.merit_url,
      a.photo_urls,
      a.description,
      a.created_at
    FROM achievements a
    JOIN users u ON a.user_id = u.id
    WHERE ${facultyFilter}
    AND a.status != 'draft'
  `;

  let idx = params.length + 1;
  const { student_id, event_type, level, year, result, search } = filters;

  if (student_id) { query += ` AND a.user_id    = $${idx++}`; params.push(student_id); }
  if (event_type) { query += ` AND a.event_type = $${idx++}`; params.push(event_type); }
  if (level)      { query += ` AND a.level      = $${idx++}`; params.push(level); }
  if (year)       { query += ` AND EXTRACT(YEAR FROM a.start_date) = $${idx++}`; params.push(parseInt(year)); }
  if (result)     { query += ` AND a.result     = $${idx++}`; params.push(result); }
  if (search)     { query += ` AND (u.name ILIKE $${idx} OR u.roll_number ILIKE $${idx})`; idx++; params.push(`%${search}%`); }

  query += ' ORDER BY u.name, a.created_at DESC';
  return { query, params };
}

// ── Shared: build a styled Excel workbook ──────────────────────────────────
function buildExcelWorkbook(rows, sheetTitle = 'Achievements', isFaculty = false) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zenith Achievements Portal';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetTitle, {
    pageSetup: { orientation: 'landscape', fitToPage: true }
  });

  // ── Header banner row ──
  ws.mergeCells('A1:O1');
  const bannerCell = ws.getCell('A1');
  bannerCell.value = 'Zenith Deemed to be University — Achievements Portal';
  bannerCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A7C6C' } };
  bannerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // ── Sub-header: export date ──
  ws.mergeCells('A2:O2');
  const subCell = ws.getCell('A2');
  subCell.value = `Exported on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  subCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F3' } };
  subCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 18;

  // ── Column definitions ──
  const columns = [
    { header: '#',                                          key: 'sno',             width: 5  },
    { header: isFaculty ? 'Faculty Name' : 'Student Name', key: 'student_name',    width: 22 },
    { header: isFaculty ? 'Faculty ID'   : 'Roll Number',  key: 'roll_number',     width: 14 },
    { header: 'Achievement Title',                          key: 'title',           width: 28 },
    { header: 'Event Name',                                 key: 'event_name',      width: 24 },
    { header: 'Event Type',                                 key: 'event_type',      width: 14 },
    { header: 'Level',                                      key: 'level',           width: 14 },
    { header: 'Place Held',                                 key: 'place_held',      width: 18 },
    { header: 'Result',                                     key: 'result',          width: 13 },
    { header: 'Position',                                   key: 'position',        width: 10 },
    { header: 'Start Date',                                 key: 'start_date',      width: 20 },
    { header: 'End Date',                                   key: 'end_date',        width: 20 },
    { header: 'Duration (days)',                            key: 'duration_days',   width: 13 },
    { header: 'Certificate File',                           key: 'certificate_url', width: 24 },
  ];

  columns.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1);
    wsCol.key   = col.key;
    wsCol.width = col.width;
  });
  ws.getColumn('start_date').numFmt = 'dd-mmm-yyyy';
  ws.getColumn('end_date').numFmt   = 'dd-mmm-yyyy';
  ws.getColumn('roll_number').numFmt = '@';

  // ── Column header row (row 3) ──
  const headerRow = ws.getRow(3);
  headerRow.height = 20;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075F54' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF0A7C6C' } },
      bottom: { style: 'thin', color: { argb: 'FF0A7C6C' } },
      left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right:  { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  });

  const fmtDate = (d) => d ? new Date(d) : '—';
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';

  rows.forEach((r, i) => {
    const dataRow = ws.addRow({
      sno:             i + 1,
      student_name:    r.student_name || '—',
      title:           r.title,
      event_name:      r.event_name,
      event_type:      cap(r.event_type),
      level:           cap(r.level),
      place_held:      r.place_held   || '—',
      result:          cap(r.result),
      position:        r.position     || '—',
      start_date:      fmtDate(r.start_date),
      end_date:        fmtDate(r.end_date),
      duration_days:   r.duration_days || '—',
      certificate_url: r.certificate_url || '—',
    });

    const rollCell = dataRow.getCell('roll_number');
    rollCell.value = String(r.roll_number || '—');
    rollCell.type = ExcelJS.ValueType.String;

    dataRow.height = 18;
    const isEven = i % 2 === 0;

    dataRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.font = { size: 10 };
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF9FAFB' }
      };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } }
      };
    });

    ['start_date', 'end_date'].forEach(key => {
      dataRow.getCell(key).numFmt = 'dd-mmm-yyyy';
    });
  });

  // ── Summary row ──
  const summaryRowNum = ws.rowCount + 1;
  const summaryRow = ws.getRow(summaryRowNum);
  ws.mergeCells(`A${summaryRowNum}:O${summaryRowNum}`);
  const summaryCell = ws.getCell(`A${summaryRowNum}`);
  summaryCell.value = `Total: ${rows.length} achievement(s)`;
  summaryCell.font = { bold: true, size: 10, color: { argb: 'FF075F54' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F3' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'middle' };
  summaryRow.height = 20;

  ws.views = [{ state: 'frozen', ySplit: 3 }];
  return wb;
}

// ── GET /api/export/my-students ───────────────────────────
router.get('/my-students', verifyToken, verifyRole('faculty'), async (req, res) => {
  try {
    const { query, params } = await buildFacultyQuery(pool, req.user.id, req.query);
    const result = await pool.query(query, params);

    const wb = buildExcelWorkbook(result.rows, 'All Student Achievements');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="achievements_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export my-students error:', err.message);
    res.status(500).json({ error: 'Export failed.' });
  }
});

// ── GET /api/export/student/:id ───────────────────────────
router.get('/student/:id', verifyToken, verifyRole('faculty'), async (req, res) => {
  try {
    const { query, params } = await buildFacultyQuery(pool, req.user.id, { student_id: req.params.id });
    const result = await pool.query(query, params);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'No achievements found for this student.' });

    const studentName = result.rows[0].student_name || 'Student';
    const wb = buildExcelWorkbook(result.rows, studentName.split(' ')[0]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${studentName.replace(/\s+/g,'_')}_achievements.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export student error:', err.message);
    res.status(500).json({ error: 'Export failed.' });
  }
});

// ── GET /api/export/achievement/:id ──────────────────────
router.get('/achievement/:id', verifyToken, verifyRole('faculty'), async (req, res) => {
  const format = (req.query.format || 'pdf').toLowerCase();

  try {
    const result = await pool.query(`
      SELECT
        a.*,
        u.name         AS student_name,
        u.roll_number,
        u.department,
        u.year_of_study,
        u.batch
      FROM achievements a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Achievement not found.' });

    const a = result.rows[0];

    if (format === 'excel') {
      const wb = buildExcelWorkbook([a], 'Achievement');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="achievement_${a.id.slice(0,8)}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

  } catch (err) {
    console.error('Export achievement error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Export failed.' });
  }
});

// ── GET /api/export/all — admin exports, filtered by role + active filters ──
// CHANGE 3: Added role filter (student/faculty) and date range (from/to).
// Frontend always passes ?role=student or ?role=faculty so each page exports
// only its own pool. Active type/date filters are forwarded so the export
// matches exactly what is shown on screen.
router.get('/all', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { role, event_type, from, to, level, department, batch, year_of_study, year } = req.query;

    let query = `
      SELECT
        a.id,
        u.name            AS student_name,
        u.roll_number,
        u.faculty_code,
        u.department,
        u.year_of_study,
        u.batch,
        u.role            AS user_role,
        a.title,
        a.event_name,
        a.event_type,
        a.level,
        a.place_held,
        a.result,
        a.position,
        a.start_date,
        a.end_date,
        a.duration_days,
        a.certificate_url,
        a.merit_url,
        a.photo_urls,
        a.description,
        a.created_at
      FROM achievements a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // Role filter — student or faculty
    if (role === 'student') {
      query += ` AND u.role = $${idx++}`;
      params.push('student');
    } else if (role === 'faculty') {
      query += ` AND u.role = $${idx++}`;
      params.push('faculty');
    }

    // Active filter forwarding
    if (event_type)    { query += ` AND a.event_type    = $${idx++}`; params.push(event_type); }
    if (from)          { query += ` AND a.start_date::date >= $${idx++}::date`; params.push(from); }
    if (to)            { query += ` AND a.start_date::date <= $${idx++}::date`; params.push(to); }
    if (level)         { query += ` AND a.level         = $${idx++}`; params.push(level); }
    if (department)    { query += ` AND u.department    = $${idx++}`; params.push(department); }
    if (batch)         { query += ` AND u.batch         = $${idx++}`; params.push(batch); }
    if (year_of_study) { query += ` AND u.year_of_study = $${idx++}`; params.push(year_of_study); }
    if (year)          { query += ` AND EXTRACT(YEAR FROM a.start_date) = $${idx++}`; params.push(parseInt(year)); }

    query += ' ORDER BY u.name, a.created_at DESC';
    const result = await pool.query(query, params);

    // Use isFaculty flag so column headers say "Faculty Name / Faculty ID"
    const isFaculty = role === 'faculty';
    const sheetTitle = role === 'student' ? 'Student Achievements'
                     : role === 'faculty' ? 'Faculty Achievements'
                     : 'All Achievements';

    // Map faculty_code into roll_number field so the shared workbook builder
    // renders it correctly regardless of role
    const rows = result.rows.map(r => ({
      ...r,
      roll_number: isFaculty ? (r.faculty_code || r.roll_number) : r.roll_number,
    }));

    const wb = buildExcelWorkbook(rows, sheetTitle, isFaculty);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${role || 'all'}_achievements_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Admin export error:', err.message);
    res.status(500).json({ error: 'Export failed.' });
  }
});

// ── GET /api/export/my-achievements — faculty exports their own ──────────
router.get('/my-achievements', verifyToken, async (req, res) => {
  try {
    const { event_type, level, result, from, to, year } = req.query;
    let query = `
      SELECT
        a.id,
        u.name            AS student_name,
        u.roll_number,
        u.faculty_code,
        u.department,
        a.title,
        a.event_name,
        a.event_type,
        a.level,
        a.place_held,
        a.result,
        a.position,
        a.start_date,
        a.end_date,
        a.duration_days,
        a.certificate_url,
        a.description
      FROM achievements a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1 AND a.status != 'draft'
    `;
    const params = [req.user.id];
    let idx = 2;

    if (event_type) { query += ` AND a.event_type  = $${idx++}`; params.push(event_type); }
    if (level)      { query += ` AND a.level       = $${idx++}`; params.push(level); }
    if (result)     { query += ` AND a.result      = $${idx++}`; params.push(result); }
    if (from)       { query += ` AND a.start_date::date >= $${idx++}::date`; params.push(from); }
    if (to)         { query += ` AND a.start_date::date <= $${idx++}::date`; params.push(to); }
    if (year)       { query += ` AND EXTRACT(YEAR FROM a.start_date) = $${idx++}`; params.push(parseInt(year)); }

    query += ' ORDER BY a.created_at DESC';
    const queryResult = await pool.query(query, params);

    const wb = buildExcelWorkbook(queryResult.rows, 'My Achievements', true);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="my_achievements_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export my-achievements error:', err.message);
    res.status(500).json({ error: 'Export failed.' });
  }
});

module.exports = router;