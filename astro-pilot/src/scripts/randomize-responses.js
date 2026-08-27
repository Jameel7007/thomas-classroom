function randomIndex(limit){
  if (limit <= 1) return 0;
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return Math.floor((value[0] / 4294967296) * limit);
  }
  return Math.floor(Math.random() * limit);
}

export function randomizeResponseGroups(root, selector){
  const groups = new Map();
  root.querySelectorAll(selector).forEach(function(option){
    const group = option.parentElement;
    if (!group) return;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(option);
  });

  groups.forEach(function(options, group){
    if (group.dataset.responseOrder) return;
    if (group.closest("[data-fixed-order]")) {
      group.dataset.responseOrder = "fixed";
      return;
    }
    if (options.length < 2) {
      group.dataset.responseOrder = "single";
      return;
    }

    const bucketsByValue = new Map();
    options.forEach(function(option, index){
      const value = option.dataset.buildTile || option.dataset.tile ||
        option.dataset.choiceOption || option.dataset.quizOption || option.dataset.option ||
        "response-" + index;
      if (!bucketsByValue.has(value)) bucketsByValue.set(value, []);
      bucketsByValue.get(value).push(option);
    });
    const buckets = Array.from(bucketsByValue.values());
    const shuffled = buckets.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = randomIndex(index + 1);
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    if (shuffled.length > 2 && shuffled.every(function(bucket, index){ return bucket === buckets[index]; })) {
      shuffled.push(shuffled.shift());
    }
    const orderedOptions = shuffled.flat();

    const markers = options.map(function(option){
      const marker = document.createComment("randomized-response");
      option.replaceWith(marker);
      return marker;
    });
    markers.forEach(function(marker, index){ marker.replaceWith(orderedOptions[index]); });
    group.dataset.responseOrder = "randomized";
  });
}
