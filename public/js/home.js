const gallery = document.getElementById('drawings');
const modalContent = document.getElementById('modal-content');
const redirectBtn = document.getElementById('play-login-btn');
const input = document.getElementById('code');
const playBtn = document.getElementById('play-btn');

if (input.value !== '') {
	playBtn.click();
	input.value = '';
}

if (redirectBtn !== null) {
	redirectBtn.onclick = () => {
		if (input.value !== '') {
			$.ajax({
				type: 'POST',
				url: '/',
				data: { code: input.value },
				success(code) {
					console.log(code);
				},
			});
		}
		return true;
	};
}

document.getElementById('pills-gallery-tab').onclick = () => {
	modalContent.setAttribute('style', 'width:200%; margin-left:-250px;');
	$.ajax({
		type: 'POST',
		url: '/show',
		success(images) {
			if (gallery === null) {
				return;
			}
			gallery.innerHTML = '';
			if (images.length === 0) {
				const p = document.createElement('p');
				p.textContent = 'Your Gallery is empty.';
				gallery.appendChild(p);
				return;
			}

			for (let i = images.length - 1; i >= 0; i -= 1) {
				const imageBox = document.createElement('div');
				imageBox.setAttribute('name', 'image-box');
				imageBox.setAttribute('style', 'width: 25%; float:left; margin-bottom: 50px;');

				const img = document.createElement('img');
				img.setAttribute('src', images[i].url);
				img.setAttribute('width', '200');
				img.setAttribute('height', '200');
				img.setAttribute('style', 'border:1px solid black;');

				const title = document.createElement('p');
				title.textContent = images[i].title;

				const downloadBtn = document.createElement('a');
				downloadBtn.setAttribute('class', 'btn btn-primary');
				downloadBtn.setAttribute('href', images[i].url);
				downloadBtn.setAttribute('style', 'margin-right:10px;');
				downloadBtn.setAttribute('download', images[i].title);
				downloadBtn.setAttribute('role', 'button');
				const span1 = document.createElement('span');
				span1.setAttribute('class', 'fas fa-download');
				downloadBtn.appendChild(span1);

				const delBtn = document.createElement('a');
				delBtn.setAttribute('class', 'btn btn-danger');
				delBtn.setAttribute('role', 'button');
				const span2 = document.createElement('span');
				span2.setAttribute('class', 'fas fa-times');
				delBtn.appendChild(span2);

				imageBox.appendChild(img);
				imageBox.appendChild(title);
				imageBox.appendChild(downloadBtn);
				imageBox.appendChild(delBtn);

				gallery.appendChild(imageBox);

				delBtn.addEventListener('click', () => {
					delBtn.parentElement.remove();
					$.ajax({
						type: 'POST',
						url: '/remove',
						data: { title: images[i].title, id: images[i].id },
					});
				});
			}
		},
	});
};
