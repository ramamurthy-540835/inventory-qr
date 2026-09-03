import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebase/admin.js';
import { allowRoles } from '../middleware/auth.js';
const router = Router(); const admin = allowRoles('SUPER_ADMIN', 'ADMIN');
const location = z.object({ locationName: z.string().min(2), locationCode: z.string().regex(/^\d{3}$/), status: z.enum(['ACTIVE','INACTIVE']).default('ACTIVE') });
const customerType = z.object({ typeName: z.string().min(2), typeCode: z.string().regex(/^[A-Z]{2}$/), status: z.enum(['ACTIVE','INACTIVE']).default('ACTIVE') });
function moduleRoute(path, collection, schema, code) {
  router.get(path, async (req,res,next) => { try { const snapshot = await db.collection(collection).orderBy(code).get(); res.json(snapshot.docs.map(d => ({ id:d.id, ...d.data() }))); } catch(e){next(e)} });
  router.post(path, admin, async (req,res,next) => { try { const input=schema.parse(req.body); const ref=db.collection(collection).doc(input[code]); await db.runTransaction(async tx => { if((await tx.get(ref)).exists) throw Object.assign(new Error(`${code} already exists`),{status:409}); tx.set(ref,{...input,createdAt:FieldValue.serverTimestamp(),createdBy:req.user.uid}); }); res.status(201).json({id:ref.id,...input}); }catch(e){next(e)} });
  router.put(`${path}/:${code}`, admin, async (req,res,next) => { try { const input=schema.partial().parse(req.body); await db.collection(collection).doc(req.params[code]).update({...input,updatedAt:FieldValue.serverTimestamp(),updatedBy:req.user.uid});res.json({ok:true});}catch(e){next(e)} });
}
moduleRoute('/locations','locations',location,'locationCode');
moduleRoute('/customer-types','customerTypes',customerType,'typeCode');
export default router;
