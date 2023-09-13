import { Form, useFetcher, useLoaderData } from 'react-router-dom';
import localforage from 'localforage';
import { matchSorter } from 'match-sorter';
import sortBy from 'sort-by';

// fake a cache so we don't slow down stuff we've already seen
let fakeCache = {};

async function fakeNetwork(key?: string) {
  if (!key) {
    fakeCache = {};
  }

  if (fakeCache[key]) {
    return;
  }

  fakeCache[key] = true;
  return new Promise((res) => {
    setTimeout(res, Math.random() * 800);
  });
}

function set(contacts?: string) {
  return localforage.setItem('contacts', contacts);
}

export async function createContact() {
  await fakeNetwork();
  const id = Math.random().toString(36).substring(2, 9);
  const contact = { id, createdAt: Date.now() };
  const contacts = await getContacts();
  contacts.unshift(contact);
  await set(contacts);
  return contact;
}

export async function getContacts(query?: string) {
  console.log('get list', query);
  await fakeNetwork(`getContacts:${query}`);
  let contacts: Array<{ [key: string]: any }> = (await localforage.getItem('contacts')) ?? [];
  if (query) {
    contacts = matchSorter(contacts, query, { keys: ['first', 'last'] });
  }
  console.log(contacts);
  return contacts.sort(sortBy('last', 'createdAt'));
}

export async function getContact(id?: string) {
  console.log('get detail');
  await fakeNetwork(`contact:${id}`);
  let contacts = await localforage.getItem('contacts');
  let contact = contacts.find((contact) => contact.id === id);
  return contact ?? null;
}

export async function loader({ params }) {
  const contact = await getContact(params.contactId);
  if (!contact) {
    throw new Response('', {
      status: 404,
      statusText: 'Not Found',
    });
  }
  return { contact };
}

export async function updateContact(id, updates) {
  await fakeNetwork();
  let contacts = await localforage.getItem('contacts');
  let contact = contacts.find((contact) => contact.id === id);
  if (!contact) throw new Error('No contact found for', id);
  Object.assign(contact, updates);
  await set(contacts);
  return contact;
}

export async function deleteContact(id) {
  let contacts = await localforage.getItem('contacts');
  let index = contacts.findIndex((contact) => contact.id === id);
  if (index > -1) {
    contacts.splice(index, 1);
    await set(contacts);
    return true;
  }
  return false;
}

export default function Contact() {
  const { contact } = useLoaderData();

  return (
    <div id='contact'>
      <div>
        <img src={contact?.avatar || null} />
      </div>

      <div>
        <h1>
          {contact.first || contact.last ? (
            <>
              {contact.first} {contact.last}
            </>
          ) : (
            <i>No Name</i>
          )}{' '}
          <Favorite contact={contact} />
        </h1>

        {contact.twitter && (
          <p>
            <a target='_blank' href={`https://twitter.com/${contact.twitter}`}>
              {contact.twitter}
            </a>
          </p>
        )}

        {contact.notes && <p>{contact.notes}</p>}

        <div>
          <Form action='edit'>
            <button type='submit'>Edit</button>
          </Form>
          <Form
            method='post'
            action='destroy'
            onSubmit={(event) => {
              if (!confirm('Please confirm you want to delete this record.')) {
                event.preventDefault();
              }
            }}
          >
            <button type='submit'>Delete</button>
          </Form>
        </div>
      </div>
    </div>
  );
}

export async function action({ request, params }) {
  let formData = await request.formData();
  return updateContact(params.contactId, {
    favorite: formData.get('favorite') === 'true',
  });
}

function Favorite({ contact }) {
  const fetcher = useFetcher();
  // yes, this is a `let` for later
  let favorite = contact.favorite;
  if (fetcher.formData) {
    favorite = fetcher.formData.get('favorite') === 'true';
  }

  return (
    <fetcher.Form method='post'>
      <button name='favorite' value={favorite ? 'false' : 'true'} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}>
        {favorite ? '★' : '☆'}
      </button>
    </fetcher.Form>
  );
}
