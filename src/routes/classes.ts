import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import express from "express";
import {db} from "../db/index.js";
import {classes, subjects, user} from "../db/schema/index.js";
const router = express.Router();

// Get all classes with optional filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, subject, teacher, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        // If search query exists, filter by class name OR invite code
        if (search) {
            filterConditions.push(
                or(
                    ilike(classes.name, `%${search}%`),
                    ilike(classes.inviteCode, `%${search}%`),
                )
            );
        }

        // If subject query exists, filter by subject name
        if (subject) {
            filterConditions.push(ilike(subjects.name, `%${subject}%`));
        }

        // If teacher query exists, filter by teacher name
        if (teacher) {
            filterConditions.push(ilike(user.name, `%${teacher}%`));
        }

        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        // Count query using drizzle sql count(*) with required joins
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        // Data query that returns class fields plus nested subject and teacher objects
        const classesList = await db
            .select({
                ...getTableColumns(classes),
                subject: getTableColumns(subjects),
                teacher: getTableColumns(user)
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause)
            .orderBy(desc(classes.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        // Response consistent with GET /subjects
        res.status(200).json({
            data: classesList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage)
            }
        });

    } catch (e) {
        console.error(`Get /classes error: ${e}`);
        res.status(500).json({ error: 'Failed to get classes' });
    }
});

router.post("/", async (req, res) => {
    try{

        const [createdClass] = await db
            .insert(classes)
            .values({...req.body, inviteCode: Math.random().toString(36).substring(2,9), schedules: []})
            .returning({id: classes.id});
        if(!createdClass) throw Error;

        res.status(201).json(createdClass);
    }catch(e){
        console.error(`Post /classes error: ${e}`);
        res.status(599).json({error: e})
    }
})

export default router;