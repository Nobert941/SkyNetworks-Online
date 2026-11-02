// SkyNetworks - publish task fix
// Fixes: null value in column "area_name" of relation "tasks" violates not-null constraint
//
// HOW TO USE:
// 1. Find your existing publish/submit function (the one that calls supabase.from('tasks').insert(...)).
// 2. Replace it with this one, or copy the area_name lines into it.
// 3. Change the selectors (#task_title etc.) to match the real ids in your HTML.
// 4. Make sure "supabase" is your Supabase client variable name.

async function publishTask() {
  // Read values straight from the form when the button is clicked.
  // This also catches browser autofill, which can skip input events.
  const title = document.querySelector('#task_title').value.trim();
  const category = document.querySelector('#task_category').value;
  const description = document.querySelector('#task_description').value.trim();
  const budget = Number(document.querySelector('#task_budget').value);
  const areaName = document.querySelector('#area_name').value.trim();

  // Validation
  if (!title || !description || !budget) {
    showError('Please fill in all required fields.');
    return;
  }
  if (!areaName) {
    showError('Please enter your town or neighbourhood.');
    return;
  }

  // Must be logged in
  const { data: userData } = await supabase.auth.getUser();
  const user = userData && userData.user;
  if (!user) {
    showError('Please log in to publish a task.');
    return;
  }

  // Insert. Keys must match your column names exactly.
  const { error } = await supabase.from('tasks').insert({
    title: title,
    category: category,
    description: description,
    budget: budget,
    area_name: areaName,                 // <-- the missing value
    lat: window.approxLat ?? null,       // optional: approximate location
    lng: window.approxLng ?? null,       // optional
    user_id: user.id
  });

  if (error) {
    showError('Your task was not published: ' + error.message);
    return;
  }

  closeModal();
  // refresh your task feed here, e.g. loadTasks();
}

// If you don't already have these helpers:
function showError(msg) {
  const box = document.querySelector('#form_error');
  if (box) { box.textContent = msg; box.style.display = 'block'; }
  else { alert(msg); }
}
