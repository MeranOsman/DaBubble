import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, ViewChild, inject } from '@angular/core';
import { OverlayService } from '../../../../services/overlay.service';
import { ReactionBarComponent } from './reaction-bar/reaction-bar.component';
import { BooleanValueService } from '../../../../services/boolean-value.service';
import { Firestore, collection, doc, getDoc, onSnapshot, query, updateDoc } from '@angular/fire/firestore';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Subscription } from 'rxjs';
import { SelectionService } from '../../../../services/selection.service';
import { DirectMessagesService } from '../../../../services/direct-messages.service';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, ReactionBarComponent, PickerComponent],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.scss'
})
export class ChatMessageComponent {
  firestore: Firestore = inject(Firestore);
  overlay = inject(OverlayService);
  booleanService = inject(BooleanValueService);
  selectionService: SelectionService = inject(SelectionService);
  DMService: DirectMessagesService = inject(DirectMessagesService);

  @Input() message: any;
  @ViewChild('emoji') emoji: ElementRef | null = null;

  selectionIdSubscription: Subscription;
  unsubscribeMessageAnswers: (() => void) | undefined;

  isOwnMessage: boolean = false;
  answersExist: boolean = false;
  isHovered: boolean = false;
  viewEmojiPicker: boolean = false;
  user: any = {};
  answers: any[] = [];
  choosenChatId: string = '';
  currentUserId: string | null = null;
  currentMessageId: string = '';
  lastAnswerTime: string = '';

  constructor() {
    this.selectionIdSubscription = this.selectionService.choosenChatTypeId.subscribe(newId => {
      this.choosenChatId = newId;
    });
    this.getCurrentUserId();
  }

  ngOnInit() {
    if (this.message && this.message.authorId) {
      const docRef = doc(this.firestore, 'users', this.message.authorId);

      getDoc(docRef).then((doc) => {
        if (doc.exists()) {
          this.user = {
            name: doc.data()['name'],
            image: doc.data()['image'],
            id: doc.id
          };
        } else {
          console.log('No such document!');
        }
      });
      this.currentMessageId = this.message['docId'];
      this.subscribeMessageAnswerChanges();
    }
  }

  subscribeMessageAnswerChanges() {
    if (this.unsubscribeMessageAnswers) {
      this.unsubscribeMessageAnswers();
    }
    else if (this.currentMessageId && this.currentMessageId !== '') {
      const messageDocRef = collection(this.firestore, 'channels', this.choosenChatId, 'messages', this.currentMessageId, 'answers');
      const q = query(messageDocRef);
      this.unsubscribeMessageAnswers = onSnapshot(q, { includeMetadataChanges: true }, (answersSnapshot: any) => {
        this.answers = [];
        answersSnapshot.docs.forEach((answer: any) => {
          this.answers.push(answer.data());
          this.checkIfAnswersExist();
          this.extractHoursAndMinutesFromUnixTime(this.answers[0].postTime)
        });
      });
    } else {
      return
    }
  }

  checkIfAnswersExist() {
    if (this.answers.length !== 0) {
      this.answersExist = true;
    }
    else {
      this.answersExist = false;
    }
  }

  async getCurrentUserId() {
    this.currentUserId = await this.DMService.getLoggedInUserId();
    if (this.currentUserId === this.message.authorId) {
      this.isOwnMessage = true;
    }
    else {
      this.isOwnMessage = false
    }
  }

  onHover(): void {
    this.isHovered = true;
  }

  onLeave(): void {
    this.isHovered = false;
  }

  openMemberView(event: MouseEvent) {
    event.stopPropagation();
    this.overlay.toggleMemberView();
    this.selectionService.selectedMemberId = this.user.id;
    this.DMService.selectedProfileName = this.user.name;
    this.DMService.selectedProfileImage = this.user.image;
    this.DMService.selectedUserName = this.user.name;
    this.DMService.selectedUserImage = this.user.image;
  }

  showThread() {
    this.booleanService.viewThread.set(true);
    this.selectionService.choosenMessageId.next(this.currentMessageId);
  }

  showEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.viewEmojiPicker = true;
  }

  @HostListener('document:click', ['$event'])
  onclick(event: Event) {
    if (this.emoji && this.emoji.nativeElement && this.emoji.nativeElement.contains(event.target)) {
      return
    } else {
      this.viewEmojiPicker = false;
    }
  }


  addEmoji(event: any) {
    const emoji = event.emoji.native;
    const docRef = doc(this.firestore, 'channels', this.choosenChatId, 'messages', this.message.docId);

    getDoc(docRef).then((docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        let reactions = data['reactions'] || {};

        if (reactions[emoji]) {
          const userIndex = reactions[emoji].users.indexOf(this.currentUserId);
          if (userIndex > -1) {
            reactions[emoji].count -= 1;
            reactions[emoji].users.splice(userIndex, 1);

            if (reactions[emoji].count === 0) {
              delete reactions[emoji];
            }
          } else {
            reactions[emoji].count += 1;
            reactions[emoji].users.push(this.currentUserId);
          }
        } else {
          reactions[emoji] = { count: 1, users: [this.currentUserId] };
        }

        updateDoc(docRef, { reactions });
      }
    });
  }

  extractHoursAndMinutesFromUnixTime(unixTimeMs: number) {
    const date = new Date(unixTimeMs);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // Verwende 24-Stunden-Format
    };
    const formattedDateTime = date.toLocaleString('de-DE', options);
    this.lastAnswerTime = formattedDateTime;
  }


  isObjectWithCount(value: any): value is { count: number } {
    return typeof value === 'object' && value !== null && 'count' in value;
  }

  ngOnDestroy() {
    if (this.unsubscribeMessageAnswers) {
      this.unsubscribeMessageAnswers();
    }
  }
}
