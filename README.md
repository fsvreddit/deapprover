This app removes users who are marked as Approved Users after a configurable period of inactivity.

Its intended use case is for private subreddits where at least occasional activity is expected.

Configurable parameters:

* Period of inactivity in months
* Flair to set when disapproving users (you can set text, CSS class and flair template independently or together)
* Modmail subject and body to send when disapproving users (optional)

Every time an approved user posts or comments, the date of their latest activity is recorded.

Once an hour, the app checks for users who last posted or commented before the inactivity period. If there are any, the user is disapproved and (if configured) a flair is set and modmail sent.

If the user deleted their account, all records of that user are removed within a week.
