CREATE UNIQUE INDEX "invitation_pending_unique" ON "invitation" USING btree ("organization_id",lower("email")) WHERE "invitation"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_unique" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_unique" ON "user" USING btree (lower("email"));