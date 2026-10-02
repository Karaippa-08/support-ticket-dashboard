const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validateCreate(body = {}) {
  const errors = {};
  const title = str(body.title);
  const description = str(body.description);
  const email = str(body.customer_email);
  const priority = body.priority ?? 'Medium';
  const status = body.status ?? 'Open';

  if (!title) errors.title = 'Title is required.';
  else if (title.length > 120) errors.title = 'Title must be 120 characters or fewer.';
  if (!description) errors.description = 'Description is required.';
  if (!email) errors.customer_email = 'Customer email is required.';
  else if (!EMAIL_RE.test(email)) errors.customer_email = 'Enter a valid email address.';
  if (!PRIORITIES.includes(priority)) errors.priority = `Priority must be one of: ${PRIORITIES.join(', ')}.`;
  if (!STATUSES.includes(status)) errors.status = `Status must be one of: ${STATUSES.join(', ')}.`;

  return { errors, value: { title, description, customer_email: email.toLowerCase(), priority, status } };
}

function validateUpdate(body = {}) {
  const errors = {};
  const value = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.status = `Status must be one of: ${STATUSES.join(', ')}.`;
    else value.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) errors.priority = `Priority must be one of: ${PRIORITIES.join(', ')}.`;
    else value.priority = body.priority;
  }
  if (!Object.keys(errors).length && !Object.keys(value).length) {
    errors.body = 'Provide at least one of: status, priority.';
  }
  return { errors, value };
}

module.exports = { validateCreate, validateUpdate, PRIORITIES, STATUSES };
