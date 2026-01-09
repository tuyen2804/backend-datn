-- Migration script to rename 'message' column to 'content' in messages table

-- Rename column from 'message' to 'content' in messages table
ALTER TABLE messages CHANGE message content TEXT NOT NULL;

-- Verify the change
DESCRIBE messages;


